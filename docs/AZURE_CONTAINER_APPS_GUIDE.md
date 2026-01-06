# Azure Container Apps Configuration Guide (Austin RTASS)

This guide documents the Azure Container Apps setup used for the Austin RTASS MVP and how to operate it day-to-day (deploy, configure secrets, restrict access, troubleshoot, and clean up after the MVP).

## Scope + Principles

- This app is a Next.js container deployed to Azure Container Apps (ACA).
- Secrets must never be committed to git. Use Azure Key Vault and/or Container App secrets.
- When you turn on **Entra ID authentication** or **IP allowlisting**, you can accidentally lock everyone out. Apply changes carefully and keep a rollback plan handy.

## Current Azure Footprint (MVP)

This repo includes Bicep IaC under `infrastructure/` that deploys the core platform:

- Resource group (shared in our environment): `rg-aph-cognitive-sandbox-dev-scus-01`
- Container App (prod): `ca-austin-rtass-prod`
- Container Apps environment: `cae-austin-rtass-prod`
- Azure Container Registry: `acraustinrtassprod` (`acraustinrtassprod.azurecr.io`)
- Key Vault: `kv-austin-rtass-prd`
- Log Analytics workspace: `log-austin-rtass-prod`

The Container App exposes:

- App: `https://<FQDN>/`
- Health: `https://<FQDN>/api/health`
- Config: `https://<FQDN>/api/config/status`

Get the actual FQDN:

```bash
az containerapp show -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod \
  --query properties.configuration.ingress.fqdn -o tsv
```

## Prerequisites

- Node.js 20+, npm 10+
- Docker (for building images)
- Azure CLI logged in: `az login`
- Azure CLI Bicep support: `az bicep install`
- Azure permissions:
  - Resource group deployment permissions (Contributor or higher)
  - Key Vault RBAC permissions to set secrets (typically **Key Vault Secrets Officer** on the vault)
  - Microsoft Entra permissions (to manage Enterprise App assignments; app registration creation may require additional directory roles)

## Deployments (IaC + App)

### 1) Choose a parameters file

Parameter files live under `infrastructure/parameters/`:

- `infrastructure/parameters/dev.bicepparam`
- `infrastructure/parameters/staging.bicepparam`
- `infrastructure/parameters/prod.bicepparam`

Key fields:

- `baseName` controls resource naming.
- `imageTag` controls which container image is deployed.
- `externalIngress` controls whether the app is publicly accessible.
- OpenAI deployment names and API version.

### 2) Deploy infrastructure (Bicep)

Use the repo deployment wrapper:

```bash
./infrastructure/deploy.sh prod --resource-group rg-aph-cognitive-sandbox-dev-scus-01
```

This creates/updates ACR, Key Vault (optional), Log Analytics, Container Apps env, and the Container App.

### 3) Set secrets (Key Vault)

If `enableKeyVault=true`, the Container App references Key Vault secrets by name. Set these (values omitted here intentionally):

```bash
az keyvault secret set --vault-name kv-austin-rtass-prd --name azure-openai-api-key --value '...'
az keyvault secret set --vault-name kv-austin-rtass-prd --name azure-openai-endpoint --value 'https://...openai.azure.com/'
```

If you get permission errors, grant the deploying identity RBAC access on the vault (example):

```bash
# One-time: let the deployer set secrets
az role assignment create \
  --assignee <your-aad-object-id-or-upn> \
  --role "Key Vault Secrets Officer" \
  --scope $(az keyvault show -g rg-aph-cognitive-sandbox-dev-scus-01 -n kv-austin-rtass-prd --query id -o tsv)
```

### 4) Build + push + update the Container App

Important: Azure Container Apps may cache by tag. Always deploy a unique tag for each release.

This repo’s `infrastructure/deploy.sh` will:

- build an `linux/amd64` image via `docker buildx`
- push to ACR
- update the Container App image

Run:

```bash
./infrastructure/deploy.sh prod --resource-group rg-aph-cognitive-sandbox-dev-scus-01 --push
```

### 5) Verify the deploy

```bash
az containerapp revision list -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod -o table
curl -i https://<FQDN>/api/config/status
```

## Authentication (Microsoft Entra ID / Azure AD)

Azure Container Apps supports built-in auth endpoints under `/.auth/*`. When enabled, unauthenticated requests will be challenged and users must be assigned to the Enterprise Application to access the app.

### Quick “sign in” URL

```text
https://<FQDN>/.auth/login/aad?post_login_redirect_uri=/
```

### Recommended setup (dedicated Entra app)

Best practice is one Entra app registration per web app, with:

- Redirect URI: `https://<FQDN>/.auth/login/aad/callback`
- Identifier URI / audience: `api://<clientId>`
- A client secret stored in the Container App secret store (`microsoft-provider-authentication-secret`)

Directory permissions vary by tenant. If `az ad app create` fails with “Insufficient privileges”, request directory role support or use the shared-app approach below.

### Shared-app setup (used in our shared RG)

In the current environment we reused an existing Entra app registration (shared with other Container Apps) because directory permissions prevented creating a new app. This has implications:

- You must add the RTASS callback URL to the shared app’s redirect URIs.
- You must create a dedicated client secret for RTASS usage and store it in the RTASS Container App secret store.
- Cleanup requires removing the RTASS callback URL and deleting the RTASS credential from the shared app.

Key identifiers (current environment):

- Tenant: `5c5e19f6-a6ab-4b45-b1d0-be4608a9a67f`
- Shared app registration (clientId): `5bc5f790-8319-4a2c-8ffe-5fdfd2200f60`

### Managing user access (add/remove people)

Access is controlled via the **Enterprise Application** backing the Entra app registration. In this tenant, assignment is required (users/groups must be explicitly assigned).

Preferred: Entra portal → Enterprise Applications → (app name) → Users and groups.

CLI (user assignment) example:

```bash
MAIL="Timothy.Vandermeer@austintexas.gov"
APP_ID="5bc5f790-8319-4a2c-8ffe-5fdfd2200f60"

USER_ID=$(az ad user list --filter "mail eq '${MAIL}'" --query "[0].id" -o tsv)
SP_ID=$(az ad sp show --id "${APP_ID}" --query id -o tsv)

# Assign user (default appRoleId is all zeros when no explicit appRoles exist)
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/users/${USER_ID}/appRoleAssignments" \
  --body "{\"principalId\":\"${USER_ID}\",\"resourceId\":\"${SP_ID}\",\"appRoleId\":\"00000000-0000-0000-0000-000000000000\"}"
```

To remove a user assignment, first find the assignment id then delete it:

```bash
ASSIGNMENT_ID=$(az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/users/${USER_ID}/appRoleAssignments?\$filter=resourceId%20eq%20${SP_ID}" \
  --query "value[0].id" -o tsv)

az rest --method DELETE \
  --url "https://graph.microsoft.com/v1.0/users/${USER_ID}/appRoleAssignments/${ASSIGNMENT_ID}"
```

## Network Access (Ingress IP Allowlist)

Ingress access restrictions are a network gate **before** Entra auth:

- Request must originate from an allowed IP/CIDR (if allowlist is configured)
- Then the user must authenticate and be assigned to the Enterprise App

List current allow rules:

```bash
az containerapp ingress access-restriction list -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod -o table
```

Add a temporary developer IP allow rule:

```bash
az containerapp ingress access-restriction set -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod \
  --rule-name dev-yourname \
  --ip-address 203.0.113.45/32 \
  --description "Temporary dev allow" \
  --action Allow
```

Remove a rule:

```bash
az containerapp ingress access-restriction remove -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod \
  --rule-name dev-yourname
```

If you are mirroring allowlists from `ca-mtranscriber-prod`, copy its rules first:

```bash
az containerapp ingress access-restriction list -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-mtranscriber-prod -o table
```

## Troubleshooting

### “Azure Container App - Unavailable” 404

If `https://<app-fqdn>/` returns an Azure “Unavailable” page but the revision FQDN works, repair traffic routing:

```bash
RG="rg-aph-cognitive-sandbox-dev-scus-01"
CA="ca-austin-rtass-prod"

# Switch to multiple revision mode (enables explicit traffic routing)
az containerapp revision set-mode -g "$RG" -n "$CA" --mode multiple

# Route to the latest revision
az containerapp ingress traffic set -g "$RG" -n "$CA" --revision-weight latest=100
```

Verify:

```bash
az containerapp show -g "$RG" -n "$CA" --query "{state:properties.provisioningState,fqdn:properties.configuration.ingress.fqdn}" -o jsonc
```

### Auth enabled, app “stops loading”

- Confirm you’re on an allowed IP/CIDR if ingress allowlist is enabled.
- Use the explicit login URL: `https://<FQDN>/.auth/login/aad?post_login_redirect_uri=/`
- If you get stuck at 401 after signing in, you may not be assigned to the Enterprise App (or a required security group).

### Secrets changes not taking effect

Container Apps may require a revision restart after secret updates:

```bash
REV=$(az containerapp show -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod --query properties.latestReadyRevisionName -o tsv)
az containerapp revision restart -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod --revision "$REV"
```

## Cleanup After MVP

Pick the cleanup level that matches your intent.

### A) “Keep it running, but remove temporary dev access”

1) Remove temporary IP allow rules (keep only corporate/VPN/proxy ranges as needed):

```bash
az containerapp ingress access-restriction list -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod -o table
az containerapp ingress access-restriction remove -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod --rule-name dev-chris-external-ip
```

2) Remove individual user assignments and manage access via a security group (recommended).

### B) Disable Entra auth (return to “public app”)

```bash
az containerapp auth update -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod --enabled false --yes
```

Optionally remove the auth secret from the Container App:

```bash
az containerapp secret remove -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod \
  --secret-names microsoft-provider-authentication-secret
```

### C) Full teardown (remove RTASS resources)

If RTASS is no longer needed, delete its resources. In our environment the resource group is shared, so delete only RTASS-specific resources (do NOT delete the RG unless you are certain it contains only RTASS resources).

Suggested order:

```bash
# App + environment
az containerapp delete -g rg-aph-cognitive-sandbox-dev-scus-01 -n ca-austin-rtass-prod --yes
az containerapp env delete -g rg-aph-cognitive-sandbox-dev-scus-01 -n cae-austin-rtass-prod --yes

# Registry (only if no other apps use it)
az acr delete -g rg-aph-cognitive-sandbox-dev-scus-01 -n acraustinrtassprod --yes

# Key Vault (only if not shared)
az keyvault delete -g rg-aph-cognitive-sandbox-dev-scus-01 -n kv-austin-rtass-prd

# Log Analytics (only if not shared)
az monitor log-analytics workspace delete -g rg-aph-cognitive-sandbox-dev-scus-01 -n log-austin-rtass-prod --yes
```

### D) Shared Entra app cleanup (only if RTASS is decommissioned)

If you used the shared Entra app registration approach:

1) Remove the RTASS redirect URI from the shared app’s redirect URIs.
2) Delete the RTASS credential on the shared app (look for credentials with display name like `rtass-containerapp-auth`).

These steps can impact other apps using the same app registration. Coordinate changes before removing shared redirect URIs or credentials.

