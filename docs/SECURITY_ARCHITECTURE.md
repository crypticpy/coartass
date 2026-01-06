# Austin RTASS - Security Architecture Document

**Document Version:** 1.2
**Last Updated:** December 2025
**Revision Notes:** v1.2 - Implemented CSP headers and configurable CORS policy per security review
**Classification:** Internal Use Only
**Prepared For:** City Security Team - Production Audit Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Decision: Single Container](#2-architecture-decision-single-container)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Container Security Architecture](#4-container-security-architecture)
5. [Azure Cloud Architecture](#5-azure-cloud-architecture)
6. [Security Controls](#6-security-controls)
7. [Data Flow and Privacy](#7-data-flow-and-privacy)
8. [Compliance Mapping](#8-compliance-mapping)
9. [Threat Model](#9-threat-model)
10. [Security Hardening Checklist](#10-security-hardening-checklist)
11. [Appendices](#11-appendices)

---

## 1. Executive Summary

### 1.1 Application Purpose

Austin RTASS is a web application that transcribes audio recordings using Azure OpenAI's GPT-4o Transcribe model with speaker diarization, and provides AI-powered analysis using GPT models. The application is designed with a **privacy-first approach** where all user data is stored client-side only (browser IndexedDB).

### 1.2 Key Security Highlights

| Security Aspect       | Implementation                                            |
|-----------------------|-----------------------------------------------------------|
| Architecture          | Single-container monolithic (unified frontend/backend)    |
| Data Storage          | Client-side only (IndexedDB) - no server-side database    |
| Secrets Management    | Azure Key Vault with RBAC and Managed Identity            |
| Container Runtime     | Non-root user (UID 1001), minimal Alpine Linux base       |
| AI Services           | Azure OpenAI (GPT-4o Transcribe, GPT-4/5 for analysis)    |
| Network Security      | HTTPS only (TLS 1.2+), security headers enforced          |
| Monitoring            | Azure Log Analytics with centralized logging              |

### 1.3 Attack Surface Summary

```
+------------------------------------------------------------------+
|                    ATTACK SURFACE ANALYSIS                        |
+------------------------------------------------------------------+
|                                                                   |
|  MINIMAL ATTACK SURFACE:                                          |
|  - No database server to compromise                               |
|  - No persistent server-side user data storage                    |
|  - Single container = single security boundary                    |
|  - No inter-service communication to intercept                    |
|                                                                   |
|  EXTERNAL DEPENDENCIES:                                           |
|  - Azure OpenAI API only (Microsoft-managed, SOC 2 compliant)     |
|                                                                   |
|  ENTRY POINTS:                                                    |
|  - HTTPS endpoint (port 443, TLS 1.2+)                            |
|  - Health check endpoint (/api/health)                            |
|                                                                   |
+------------------------------------------------------------------+
```

---

## 2. Architecture Decision: Single Container

### 2.1 Why We Chose Single Container Over Microservices

This application uses a **unified single-container architecture** rather than separate frontend and backend services. This was a deliberate security and operational decision.

#### Security Rationale

| Benefit                      | Description                                              |
|------------------------------|----------------------------------------------------------|
| Reduced Attack Surface       | Single entry point, no inter-service APIs to exploit     |
| Simplified Secrets           | One identity, one Key Vault access point                 |
| No Service Mesh Required     | No mTLS configuration or service discovery vulnerabilities|
| Single Audit Target          | One container image to scan and verify                   |
| Atomic Security Updates      | Update once, deploy once, no version mismatches          |

#### Operational Rationale

| Benefit                      | Description                                              |
|------------------------------|----------------------------------------------------------|
| Atomic Deployments           | Frontend and backend always in sync                      |
| Simplified Debugging         | Single log stream, no distributed tracing needed         |
| Lower Infrastructure Cost    | One container, one scaling policy                        |
| Reduced Operational Overhead | Single health check, single monitoring target            |

#### Why This Works for Our Use Case

```
+------------------------------------------------------------------+
|                 ARCHITECTURE APPROPRIATENESS                      |
+------------------------------------------------------------------+
|                                                                   |
|  THIS APPLICATION IS WELL-SUITED FOR SINGLE CONTAINER:            |
|                                                                   |
|  [x] No server-side database                                      |
|      - Data stored in browser IndexedDB                           |
|      - No need for separate data tier                             |
|                                                                   |
|  [x] Single external dependency                                   |
|      - Only Azure OpenAI API calls                                |
|      - No message queues or event buses                           |
|                                                                   |
|  [x] Stateless request handling                                   |
|      - Each request is independent                                |
|      - No session state on server                                 |
|                                                                   |
|  [x] Moderate scaling requirements                                |
|      - 1-3 replicas sufficient                                    |
|      - HTTP-based autoscaling                                     |
|                                                                   |
|  [x] Same team owns frontend and backend                          |
|      - No organizational boundary                                 |
|      - Unified release cycle                                      |
|                                                                   |
+------------------------------------------------------------------+
```

#### When We Would Consider Separation

Microservices would be reconsidered if:
- Server-side database is added
- Multiple external API integrations are required
- Different scaling requirements for frontend vs backend
- Separate teams need to deploy independently

---

## 3. System Architecture Overview

### 3.1 High-Level Architecture

```
+=========================================================================+
|                         AZURE CLOUD BOUNDARY                            |
+=========================================================================+
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |              AZURE CONTAINER APPS ENVIRONMENT                     |  |
|  |                                                                   |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  |                 CONTAINER APP (austin-rtass)                |  |  |
|  |  |                                                             |  |  |
|  |  |  +-------------------------------------------------------+  |  |  |
|  |  |  |              SINGLE DOCKER CONTAINER                  |  |  |  |
|  |  |  |                                                       |  |  |  |
|  |  |  |  +------------------------------------------------+   |  |  |  |
|  |  |  |  |           NEXT.JS 15 APPLICATION               |   |  |  |  |
|  |  |  |  |                                                |   |  |  |  |
|  |  |  |  |   +--------------+    +------------------+     |   |  |  |  |
|  |  |  |  |   |   Frontend   |    |   API Routes     |     |   |  |  |  |
|  |  |  |  |   |   (React)    |<-->|   (Backend)      |     |   |  |  |  |
|  |  |  |  |   +--------------+    +--------+---------+     |   |  |  |  |
|  |  |  |  |                                |               |   |  |  |  |
|  |  |  |  +--------------------------------|---------------+   |  |  |  |
|  |  |  |                                   |                   |  |  |  |
|  |  |  |   User: nextjs (UID 1001)         |                   |  |  |  |
|  |  |  |   Port: 3000 (internal)           |                   |  |  |  |
|  |  |  +-----------------------------------|-------------------+  |  |  |
|  |  |                                      |                      |  |  |
|  |  +--------------------------------------|----------------------+  |  |
|  |                                         |                         |  |
|  +-----------------------------------------|-------------------------+  |
|                                            |                            |
|  +------------------+    +-----------------v--------------------------+ |
|  |   KEY VAULT      |    |           AZURE OPENAI SERVICE             | |
|  |   (Secrets)      |    |                                            | |
|  |                  |    |   - GPT-4o Transcribe Diarize (primary)    | |
|  |   - API Keys     |    |   - GPT-4/5 (analysis)                     | |
|  |   - Endpoints    |    |   - Whisper (fallback transcription)       | |
|  +------------------+    +--------------------------------------------+ |
|                                                                         |
|  +------------------+    +--------------------------------------------+ |
|  | CONTAINER        |    | LOG ANALYTICS WORKSPACE                    | |
|  | REGISTRY (ACR)   |    |                                            | |
|  |                  |    |   - Application logs                       | |
|  | - Private images |    |   - Container metrics                      | |
|  | - Vuln scanning  |    |   - Security alerts                        | |
|  +------------------+    +--------------------------------------------+ |
|                                                                         |
+=========================================================================+
                                    ^
                                    | HTTPS (TLS 1.2+)
                                    |
+=========================================================================+
|                           USER BROWSER                                  |
+=========================================================================+
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                         INDEXED DB                                |  |
|  |                                                                   |  |
|  |   +-----------+  +-----------+  +-----------+  +--------------+   |  |
|  |   |Transcripts|  | Analyses  |  |Audio Files|  |Conversations |   |  |
|  |   +-----------+  +-----------+  +-----------+  +--------------+   |  |
|  |                                                                   |  |
|  |   ALL DATA STORED CLIENT-SIDE ONLY - NO SERVER-SIDE PERSISTENCE  |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
+=========================================================================+
```

### 3.2 Architecture Characteristics

| Characteristic     | Description                                     |
|--------------------|-------------------------------------------------|
| Pattern            | Monolithic (unified frontend + backend)         |
| Framework          | Next.js 14 with App Router                      |
| Runtime            | Node.js 20 LTS on Alpine Linux                  |
| Containerization   | Single Docker container (~300MB)                |
| Orchestration      | Azure Container Apps (serverless)               |
| Scaling            | Horizontal (1-3 replicas, HTTP-based autoscale) |
| Data Persistence   | Client-side IndexedDB only                      |

### 3.3 AI Model Configuration

| Function          | Model                           | Format            |
|-------------------|---------------------------------|-------------------|
| Transcription     | GPT-4o Transcribe Diarize       | diarized_json     |
| Transcription     | Whisper (fallback)              | verbose_json      |
| Analysis          | GPT-4 / GPT-5                   | chat completions  |
| Summary           | GPT-4 / GPT-5                   | chat completions  |

---

## 4. Container Security Architecture

### 4.1 Multi-Stage Build Process

```
+=====================================================================+
|                      DOCKER BUILD STAGES                            |
+=====================================================================+
|                                                                     |
|  STAGE 1: DEPS (~500MB)           STAGE 2: BUILDER (~800MB)         |
|  +-------------------------+      +-----------------------------+   |
|  |  node:20-alpine         |      |  node:20-alpine             |   |
|  |                         |      |                             |   |
|  |  - npm ci               |----->|  - Copy node_modules        |   |
|  |  - frozen-lockfile      |      |  - Copy source code         |   |
|  |  - Exact versions       |      |  - npm run build            |   |
|  |                         |      |                             |   |
|  |  NO dev dependencies    |      |  Output: .next/standalone   |   |
|  |  in final image         |      |                             |   |
|  +-------------------------+      +-------------+---------------+   |
|                                                 |                   |
|                                                 v                   |
|                              STAGE 3: RUNNER (~300MB)               |
|                              +-----------------------------+        |
|                              |  node:20-alpine             |        |
|                              |                             |        |
|                              |  [x] Non-root user (1001)   |        |
|                              |  [x] Minimal packages only  |        |
|                              |  [x] dumb-init for PID 1    |        |
|                              |  [x] Health checks enabled  |        |
|                              |  [x] Security patches       |        |
|                              |  [x] Production mode only   |        |
|                              |                             |        |
|                              |  FINAL IMAGE: ~300MB        |        |
|                              +-----------------------------+        |
|                                                                     |
+=====================================================================+
```

### 4.2 Container Security Controls

| Control                  | Implementation                 | CIS Benchmark    |
|--------------------------|--------------------------------|------------------|
| Non-root User            | User: nextjs (UID 1001)        | CIS Docker 4.1   |
| Minimal Base Image       | Alpine Linux (~5MB base)       | CIS Docker 4.2   |
| No Unnecessary Packages  | Only dumb-init + libc6-compat  | CIS Docker 4.4   |
| Security Patches         | apk upgrade in build           | CIS Docker 4.4   |
| Dropped Capabilities     | cap_drop: ALL                  | CIS Docker 5.3   |
| No Privilege Escalation  | no-new-privileges: true        | CIS Docker 5.25  |
| Signal Handling          | dumb-init for graceful shutdown| Best Practice    |
| Health Checks            | HTTP /api/health endpoint      | Best Practice    |

### 4.3 Final Image Contents

```
+=====================================================================+
|                    PRODUCTION IMAGE CONTENTS                        |
+=====================================================================+
|                                                                     |
|  /app                                                               |
|  |-- server.js              # Next.js standalone server             |
|  |-- node_modules/          # Production dependencies only          |
|  |-- .next/                                                         |
|  |   +-- static/            # Compiled static assets (CSS, JS)      |
|  +-- public/                # Public static files                   |
|                                                                     |
|  User:  nextjs (UID 1001, GID 1001)                                 |
|  Port:  3000                                                        |
|  Entry: dumb-init -- node server.js                                 |
|                                                                     |
+=====================================================================+
|                    EXCLUDED FROM FINAL IMAGE                        |
+=====================================================================+
|                                                                     |
|  [x] Development dependencies (devDependencies)                     |
|  [x] Source code (TypeScript files)                                 |
|  [x] Test files and coverage reports                                |
|  [x] Documentation files                                            |
|  [x] Environment files (.env*)                                      |
|  [x] Git history and configuration                                  |
|  [x] Build tools and caches                                         |
|  [x] IDE configuration files                                        |
|                                                                     |
+=====================================================================+
```

---

## 5. Azure Cloud Architecture

### 5.1 Resource Topology

```
+=========================================================================+
|                        AZURE RESOURCE GROUP                             |
|                      (rg-austin-rtass-{env})                            |
+=========================================================================+
|                                                                         |
|  NETWORKING & ACCESS                                                    |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  Internet --> [Azure Front Door] --> [Container App Ingress]     |  |
|  |                     |                        |                    |  |
|  |                     v                        v                    |  |
|  |              +----------+            +---------------+            |  |
|  |              |   WAF    |            | TLS 1.2+      |            |  |
|  |              | (option) |            | Auto-managed  |            |  |
|  |              +----------+            +---------------+            |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  COMPUTE LAYER                                                          |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  Container Apps Environment: cae-mtranscriber-{env}               |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  |                                                             |  |  |
|  |  |  Container App: ca-mtranscriber-{env}                       |  |  |
|  |  |                                                             |  |  |
|  |  |  +-----------+   +-----------+   +-----------+              |  |  |
|  |  |  | Replica 1 |   | Replica 2 |   | Replica 3 |              |  |  |
|  |  |  | 0.5 vCPU  |   | 0.5 vCPU  |   | 0.5 vCPU  |              |  |  |
|  |  |  | 1Gi RAM   |   | 1Gi RAM   |   | 1Gi RAM   |              |  |  |
|  |  |  +-----------+   +-----------+   +-----------+              |  |  |
|  |  |        |               |               |                    |  |  |
|  |  |        +-------+-------+-------+-------+                    |  |  |
|  |  |                |                                            |  |  |
|  |  |         Load Balancer                                       |  |  |
|  |  |         Min: 1 | Max: 3 replicas                            |  |  |
|  |  |         Scale: 100 concurrent requests                      |  |  |
|  |  |                                                             |  |  |
|  |  +-------------------------------------------------------------+  |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  SUPPORTING SERVICES                                                    |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  +----------------+  +----------------+  +---------------------+  |  |
|  |  |   Key Vault    |  |  Container     |  |   Log Analytics     |  |  |
|  |  |                |  |  Registry      |  |   Workspace         |  |  |
|  |  |  - API Keys    |  |                |  |                     |  |  |
|  |  |  - Endpoints   |  |  - Private     |  |  - App logs         |  |  |
|  |  |  - RBAC access |  |  - Scanning    |  |  - Metrics          |  |  |
|  |  |                |  |  - Managed ID  |  |  - Alerts           |  |  |
|  |  +----------------+  +----------------+  +---------------------+  |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  IDENTITY & ACCESS (NO CREDENTIALS IN CODE)                             |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  System-Assigned Managed Identity (Container App)                 |  |
|  |                                                                   |  |
|  |    [Container App] ---(AcrPull)--------> [Container Registry]     |  |
|  |    [Container App] ---(SecretsUser)----> [Key Vault]              |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
+=========================================================================+
```

### 5.2 Managed Identity Authentication Flow

```
+=====================================================================+
|               MANAGED IDENTITY AUTHENTICATION FLOW                  |
+=====================================================================+
|                                                                     |
|  Container App                                                      |
|  +---------------------+                                            |
|  |                     |    1. Request token                        |
|  |   Application Code  |--------------------------------+           |
|  |                     |                                |           |
|  |   (NO credentials   |    2. Return token             v           |
|  |    stored in code)  |<-----------------------+  +----------+     |
|  |                     |                        |  |  Azure   |     |
|  +----------+----------+                        +--+  IMDS    |     |
|             |                                      +----------+     |
|             |                                                       |
|             | 3. Present token                                      |
|             |                                                       |
|    +--------v--------+                +------------------+          |
|    |                 |                |                  |          |
|    |   Key Vault     |                |  Container       |          |
|    |                 |                |  Registry        |          |
|    |  4. Validate    |                |                  |          |
|    |  5. Return      |                |  4. Validate     |          |
|    |     secrets     |                |  5. Return image |          |
|    |                 |                |                  |          |
|    +-----------------+                +------------------+          |
|                                                                     |
|  SECURITY BENEFIT:                                                  |
|  - No credentials in code, config, or environment                   |
|  - Azure manages credential rotation automatically                  |
|  - No credential exposure risk                                      |
|                                                                     |
+=====================================================================+
```

### 5.3 Azure Resource Security Settings

| Resource            | Security Configuration                              |
|---------------------|-----------------------------------------------------|
| Container App       | System-assigned managed identity, HTTPS only        |
| Key Vault           | RBAC authorization, soft delete, purge protection   |
| Container Registry  | Private (no anon pull), managed identity auth       |
| Log Analytics       | 30-day retention, data encryption at rest           |
| Container Env       | Consumption workload profile, Log Analytics linked  |

---

## 6. Security Controls

### 6.1 Network Security Layers

```
+=====================================================================+
|                      NETWORK SECURITY LAYERS                        |
+=====================================================================+
|                                                                     |
|  LAYER 1: EDGE PROTECTION                                           |
|  +---------------------------------------------------------------+  |
|  |  - HTTPS only (HTTP requests redirected)                      |  |
|  |  - TLS 1.2+ enforced (no legacy protocols)                    |  |
|  |  - Azure infrastructure DDoS protection                       |  |
|  |  - Optional: Azure Front Door + Web Application Firewall      |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  LAYER 2: APPLICATION SECURITY HEADERS (Implemented)                |
|  +---------------------------------------------------------------+  |
|  |  Content-Security-Policy: Comprehensive CSP with:             |  |
|  |    - default-src 'self'                                       |  |
|  |    - script-src 'self' 'unsafe-inline' 'unsafe-eval'          |  |
|  |    - connect-src 'self' https://*.openai.azure.com            |  |
|  |    - frame-ancestors 'none' (clickjacking protection)         |  |
|  |    - upgrade-insecure-requests                                |  |
|  |  X-Content-Type-Options: nosniff                              |  |
|  |  X-Frame-Options: DENY                                        |  |
|  |  Referrer-Policy: strict-origin-when-cross-origin             |  |
|  |  Permissions-Policy: camera=(self), microphone=(self)         |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  LAYER 3: CORS POLICY (Configurable)                                |
|  +---------------------------------------------------------------+  |
|  |  Default: CORS disabled (empty origins = most restrictive)    |  |
|  |  Configurable via corsAllowedOrigins parameter in Bicep       |  |
|  |  When enabled:                                                |  |
|  |    - Allowed Methods: GET, POST, PUT, DELETE, OPTIONS         |  |
|  |    - Allowed Headers: Content-Type, Authorization, X-Req...   |  |
|  |    - Max Age: 86400 seconds                                   |  |
|  |  Production: Set to specific domain(s) if cross-origin needed |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  LAYER 4: CONTAINER NETWORK ISOLATION                               |
|  +---------------------------------------------------------------+  |
|  |  - Container runs in isolated network namespace               |  |
|  |  - Only port 3000 exposed internally                          |  |
|  |  - No inter-container communication required                  |  |
|  |  - Application only makes outbound calls to Azure OpenAI      |  |
|  |    (architectural constraint, not network-enforced)           |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+=====================================================================+
```

### 6.2 Secrets Management

| Secret                 | Storage Location | Access Method              |
|------------------------|------------------|----------------------------|
| Azure OpenAI API Key   | Azure Key Vault  | Managed Identity + secretRef |
| Azure OpenAI Endpoint  | Azure Key Vault  | Managed Identity + secretRef |
| Container Registry     | Azure (Managed)  | System-assigned identity    |

**Security Properties:**
- No secrets in source code
- No secrets in container image
- No secrets in environment files (committed)
- Secrets retrieved at runtime via managed identity
- Automatic credential rotation support

### 6.3 Application Security

| Control              | Implementation                                |
|----------------------|-----------------------------------------------|
| Input Validation     | Zod schemas for all API inputs                |
| Error Handling       | Sanitized responses (no stack traces in prod) |
| Logging              | Structured logs to Log Analytics (no PII)     |
| File Upload          | Type validation, size limits, filename hashing |
| Health Checks        | Liveness and readiness probes configured      |
| Dependency Security  | npm audit in CI/CD pipeline                   |

### 6.4 Container Runtime Security

```yaml
# Security configuration applied
security_opt:
  - no-new-privileges:true    # Prevent privilege escalation

cap_drop:
  - ALL                        # Drop all Linux capabilities

user: nextjs (1001:1001)      # Non-root user

healthcheck:
  test: ["CMD", "node", "-e", "..."]
  interval: 30s
  timeout: 3s
  retries: 3
```

---

## 7. Data Flow and Privacy

### 7.1 Data Flow Diagram

```
+=====================================================================+
|                         DATA FLOW DIAGRAM                           |
+=====================================================================+
|                                                                     |
|  USER BROWSER (Client-Side Processing)                              |
|  +---------------------------+                                      |
|  |                           |                                      |
|  |  1. User uploads audio    |                                      |
|  |                           |                                      |
|  |  2. Audio processed       |                                      |
|  |     CLIENT-SIDE:          |                                      |
|  |     - Convert to MP3      |                                      |
|  |     - Split at silence    |                                      |
|  |       (~5 min chunks)     |                                      |
|  |     - Obfuscate filenames |                                      |
|  |       (UUID + extension)  |                                      |
|  |                           |                                      |
|  +------------+--------------+                                      |
|               |                                                     |
|               | HTTPS (TLS 1.2+)                                    |
|               | Individual chunks                                   |
|               v                                                     |
|  +---------------------------+         +-------------------------+  |
|  |                           |         |                         |  |
|  |  APPLICATION SERVER       |         |     AZURE OPENAI        |  |
|  |  (Transient Processing)   |         |  (Internal Endpoints)   |  |
|  |                           |         |                         |  |
|  |  3. Receive chunk         |         |  4. GPT-4o Transcribe   |  |
|  |     (in-memory only)      |-------->|     processes chunk     |  |
|  |                           |  HTTPS  |                         |  |
|  |  5. Return transcript     |         |  (Audio NOT retained    |  |
|  |     segments              |<--------|   by Azure OpenAI)      |  |
|  |                           |         |                         |  |
|  +------------+--------------+         +-------------------------+  |
|               |                                                     |
|               | HTTPS                                               |
|               v                                                     |
|  +---------------------------+                                      |
|  |                           |                                      |
|  |  USER BROWSER             |                                      |
|  |                           |                                      |
|  |  6. Reassemble chunks     |                                      |
|  |     CLIENT-SIDE           |                                      |
|  |     (Full transcript      |                                      |
|  |      reconstructed only   |                                      |
|  |      in browser)          |                                      |
|  |                           |                                      |
|  |  7. Store in IndexedDB    |                                      |
|  |     - Transcripts         |                                      |
|  |     - Analyses            |                                      |
|  |     - Audio files         |                                      |
|  |     - Conversations       |                                      |
|  |                           |                                      |
|  |  DATA REMAINS ON          |                                      |
|  |  USER'S DEVICE            |                                      |
|  +---------------------------+                                      |
|                                                                     |
+=====================================================================+
```

### 7.2 Data Classification

| Data Type          | Classification | Storage Location    | Retention        |
|--------------------|----------------|---------------------|------------------|
| Audio Recordings   | Sensitive      | Client IndexedDB    | User-controlled  |
| Transcripts        | Sensitive      | Client IndexedDB    | User-controlled  |
| Analysis Results   | Internal       | Client IndexedDB    | User-controlled  |
| Chat Conversations | Internal       | Client IndexedDB    | User-controlled  |
| Application Logs   | Operational    | Azure Log Analytics | 30 days (config) |
| API Keys           | Secret         | Azure Key Vault     | Managed          |

### 7.3 Privacy-by-Design Principles

1. **Data Minimization**: Server processes data transiently, no persistent storage
2. **Purpose Limitation**: Data used only for transcription and analysis
3. **Storage Limitation**: All user data stored client-side, user controls deletion
4. **User Control**: Users can delete their data at any time (clear IndexedDB)
5. **Transparency**: No hidden data collection or third-party sharing
6. **Filename Protection**: Original filenames hashed before logging (PII protection)

### 7.4 Azure OpenAI Data Handling

When using Azure OpenAI (recommended configuration):

| Aspect           | Policy                                              |
|------------------|-----------------------------------------------------|
| Training Data    | NOT used to train or improve models                 |
| Data Retention   | NOT retained after processing                       |
| Compliance       | SOC 2, ISO 27001, HIPAA eligible                    |
| Data Residency   | Processed in configured Azure region                |

### 7.5 Transcription Pipeline Security

The transcription pipeline implements multiple security controls to protect audio content:

```
+=====================================================================+
|              TRANSCRIPTION SECURITY ARCHITECTURE                     |
+=====================================================================+
|                                                                     |
|  AUDIO SEGMENTATION (Client-Side, Browser)                          |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [Original Audio File]                                        |  |
|  |         |                                                     |  |
|  |         v                                                     |  |
|  |  +-------------+    +-------------+    +-------------+        |  |
|  |  | FFmpeg WASM |    | Silence     |    | Chunk       |        |  |
|  |  | Conversion  |--->| Detection   |--->| Generator   |        |  |
|  |  +-------------+    +-------------+    +-------------+        |  |
|  |                                              |                |  |
|  |                                              v                |  |
|  |  +-------+  +-------+  +-------+  +-------+  +-------+        |  |
|  |  |Chunk 1|  |Chunk 2|  |Chunk 3|  |Chunk 4|  |Chunk N|        |  |
|  |  |~5 min |  |~5 min |  |~5 min |  |~5 min |  |~5 min |        |  |
|  |  +-------+  +-------+  +-------+  +-------+  +-------+        |  |
|  |                                                               |  |
|  |  SECURITY PROPERTIES:                                         |  |
|  |  - No complete meeting file transmitted as single unit        |  |
|  |  - Split points occur at natural silence boundaries           |  |
|  |  - Each chunk is independently processable                    |  |
|  |  - Original file hash is non-reconstructable from chunks      |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  FILENAME OBFUSCATION (Per-Chunk, Before Transmission)              |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  Original: "Budget_Meeting_Q4_2024_Confidential.mp3"          |  |
|  |                          |                                    |  |
|  |                          v                                    |  |
|  |  Transmitted: "a3f7c2d1-8e9b-4a5c-b6d7-e8f9a0b1c2d3.mp3"      |  |
|  |                                                               |  |
|  |  - Original filename NEVER sent to Azure OpenAI               |  |
|  |  - UUID generated per-chunk (crypto.randomUUID())             |  |
|  |  - Only file extension preserved (for format detection)       |  |
|  |  - Prevents PII leakage through filename metadata             |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  TRANSMISSION SECURITY                                               |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  - Chunks transmitted via HTTPS (TLS 1.2+)                    |  |
|  |  - Each chunk processed independently                         |  |
|  |  - In-memory processing only (no server-side storage)         |  |
|  |  - Azure OpenAI does NOT retain audio after processing        |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  REASSEMBLY (Client-Side Only)                                      |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  - Transcript segments merged in browser                      |  |
|  |  - Timestamp continuity maintained across chunks              |  |
|  |  - Full transcript exists ONLY in user's IndexedDB            |  |
|  |  - Server never sees or stores complete transcript            |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+=====================================================================+
```

| Security Control             | Implementation                                    |
|------------------------------|---------------------------------------------------|
| Audio Segmentation           | ~5 min chunks at silence boundaries (client-side) |
| Filename Obfuscation         | UUID replacement, original never transmitted       |
| Hash Non-Reconstruction      | Chunks cannot be used to recreate original hash   |
| Transmission Encryption      | HTTPS/TLS 1.2+ for all chunk transfers            |
| Server-Side Storage          | None - in-memory processing only                  |
| Azure Retention              | Audio NOT retained after transcription            |
| Reassembly Location          | Client browser only (IndexedDB)                   |

### 7.6 Analysis Pipeline Security

The analysis pipeline processes transcript text (not audio) through Azure OpenAI:

```
+=====================================================================+
|                 ANALYSIS SECURITY ARCHITECTURE                       |
+=====================================================================+
|                                                                     |
|  INPUT HANDLING                                                      |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  What IS sent to Azure OpenAI:                                |  |
|  |  - Transcript text with timestamp markers                     |  |
|  |  - Analysis template prompts                                  |  |
|  |  - System prompts for structured extraction                   |  |
|  |                                                               |  |
|  |  What is NOT sent to Azure OpenAI:                            |  |
|  |  - Original audio files                                       |  |
|  |  - Original filenames                                         |  |
|  |  - User identifiers or session data                           |  |
|  |  - Browser fingerprints or device information                 |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  PROCESSING MODEL                                                    |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  Strategy Selection (automatic based on transcript size):     |  |
|  |                                                               |  |
|  |  +----------+  +----------+  +------------+                   |  |
|  |  |  BASIC   |  |  HYBRID  |  |  ADVANCED  |                   |  |
|  |  |  <50k    |  |  50-150k |  |  >150k     |                   |  |
|  |  |  tokens  |  |  tokens  |  |  tokens    |                   |  |
|  |  |  1 call  |  |  3 calls |  |  9+ calls  |                   |  |
|  |  +----------+  +----------+  +------------+                   |  |
|  |                                                               |  |
|  |  Each API call:                                               |  |
|  |  - Transient processing (no server-side caching)              |  |
|  |  - Structured JSON output returned to client                  |  |
|  |  - Results stored ONLY in client IndexedDB                    |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  DATA RETENTION                                                      |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  Server-Side: NONE                                            |  |
|  |  - All processing is transient (in-memory)                    |  |
|  |  - No logs contain transcript text                            |  |
|  |  - Only operational metrics logged (token counts, durations)  |  |
|  |                                                               |  |
|  |  Azure OpenAI: NONE                                           |  |
|  |  - Data NOT used for model training                           |  |
|  |  - Data NOT retained after processing                         |  |
|  |  - Compliant with Azure data handling policies                |  |
|  |                                                               |  |
|  |  Client-Side: User-Controlled                                 |  |
|  |  - Analyses stored in browser IndexedDB                       |  |
|  |  - User can delete at any time                                |  |
|  |  - No automatic expiration (user's data, user's control)      |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  PII HANDLING DURING ANALYSIS                                        |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  - Transcript text may contain PII from meeting discussions   |  |
|  |  - Application does NOT filter or redact PII before analysis  |  |
|  |  - Azure OpenAI processes content transiently                 |  |
|  |  - Users responsible for content sensitivity decisions        |  |
|  |                                                               |  |
|  |  Logging PII Protection:                                      |  |
|  |  - Filenames hashed before logging (non-reversible)           |  |
|  |  - Transcript content NEVER logged                            |  |
|  |  - Only structural metadata logged (token counts, durations)  |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+=====================================================================+
```

| Security Control             | Implementation                                    |
|------------------------------|---------------------------------------------------|
| Input Scope                  | Transcript text only (no audio, no filenames)     |
| PII Handling                 | Azure OpenAI processes transiently, no retention  |
| Server-Side Storage          | None - all processing is transient                |
| Result Storage               | Client IndexedDB only (user-controlled)           |
| Logging Protection           | No transcript content logged, filenames hashed    |
| Access Controls              | Azure RBAC, Managed Identity, Key Vault secrets   |

### 7.7 Infrastructure Control

Both transcription and analysis pipelines use internally-managed Azure infrastructure:

```
+=====================================================================+
|              INFRASTRUCTURE SECURITY CONTROLS                        |
+=====================================================================+
|                                                                     |
|  AZURE OPENAI ENDPOINT CONFIGURATION                                 |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  Endpoint Type: Internal Azure OpenAI Service                 |  |
|  |                                                               |  |
|  |  Configuration Management:                                    |  |
|  |  - Austin Technology Services (ATS) controls applied          |  |
|  |  - Information Security Office (ISO) configuration management |  |
|  |  - Centralized endpoint governance                            |  |
|  |                                                               |  |
|  |  Access Controls:                                             |  |
|  |  - Azure Managed Identity (no credentials in code)            |  |
|  |  - Azure Key Vault for API key storage                        |  |
|  |  - RBAC policies enforced                                     |  |
|  |                                                               |  |
|  |  Network Security:                                            |  |
|  |  - HTTPS-only communication                                   |  |
|  |  - Azure backbone network (no public internet transit)        |  |
|  |  - TLS 1.2+ enforced                                          |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  DEPLOYMENT CONFIGURATION                                            |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  Transcription Deployment:                                    |  |
|  |  - GPT-4o Transcribe Diarize (primary)                        |  |
|  |  - Whisper (fallback)                                         |  |
|  |  - API Version: 2025-03-01-preview                            |  |
|  |                                                               |  |
|  |  Analysis Deployment:                                         |  |
|  |  - GPT-5 (standard context)                                   |  |
|  |  - GPT-4.1 (extended context >256k tokens)                    |  |
|  |  - Automatic model selection based on transcript size         |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  COMPLIANCE CERTIFICATIONS                                           |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  Azure OpenAI Service maintains:                              |  |
|  |  - SOC 2 Type II certification                                |  |
|  |  - ISO 27001 certification                                    |  |
|  |  - HIPAA eligibility (with BAA)                               |  |
|  |  - FedRAMP authorization (Azure Government)                   |  |
|  |                                                               |  |
|  |  Data Processing:                                             |  |
|  |  - Data NOT used for model training                           |  |
|  |  - Data NOT retained after processing                         |  |
|  |  - Regional data residency (configured deployment region)     |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+=====================================================================+
```

| Infrastructure Control       | Implementation                                    |
|------------------------------|---------------------------------------------------|
| Endpoint Management          | Internal Azure OpenAI under ATS/ISO controls      |
| Secret Storage               | Azure Key Vault with RBAC                         |
| Authentication               | Managed Identity (no credentials in code)         |
| Network Transit              | Azure backbone, HTTPS/TLS 1.2+                    |
| Configuration Governance     | ATS/ISO change management processes               |
| Azure Compliance             | SOC 2, ISO 27001, HIPAA eligible                  |

---

## 8. Compliance Mapping

### 8.1 OWASP Top 10 (2021) Mapping

| OWASP Risk                    | Mitigation                           | Status       |
|-------------------------------|--------------------------------------|--------------|
| A01: Broken Access Control    | No user accounts, client-side data   | N/A          |
| A02: Cryptographic Failures   | TLS 1.2+, Key Vault for secrets      | Mitigated    |
| A03: Injection                | Zod validation, no SQL database, React auto-escaping, CSP | Mitigated |
| A04: Insecure Design          | CSP headers, security headers, minimal attack surface | Mitigated |
| A05: Security Misconfiguration| IaC (Bicep), no default credentials, configurable CORS | Mitigated |
| A06: Vulnerable Components    | npm audit, Alpine, regular updates   | Mitigated    |
| A07: Auth Failures            | API key via Key Vault, managed ID    | Mitigated    |
| A08: Data Integrity           | HTTPS only, input validation         | Mitigated    |
| A09: Logging Failures         | Azure Log Analytics, structured logs | Mitigated    |
| A10: SSRF                     | No user-controllable URL fetching    | Mitigated    |

### 8.2 CIS Docker Benchmark Mapping

| CIS Control                         | Implementation              | Status |
|-------------------------------------|-----------------------------|--------|
| 4.1 Create user for container       | User: nextjs (UID 1001)     | Pass   |
| 4.2 Use trusted base images         | node:20-alpine (Official)   | Pass   |
| 4.3 Install necessary packages only | Minimal Alpine + dumb-init  | Pass   |
| 4.4 Scan and rebuild for patches    | apk upgrade in Dockerfile   | Pass   |
| 4.5 Enable Content Trust            | Configurable in registry    | Note   |
| 5.3 Restrict Linux capabilities     | cap_drop: ALL               | Pass   |
| 5.12 Mount filesystem read-only     | Supported via orchestrator  | Note   |
| 5.25 Restrict privilege escalation  | no-new-privileges: true     | Pass   |
| 5.28 Use PIDs cgroup limit          | Container Apps managed      | Pass   |

### 8.3 NIST Cybersecurity Framework

| Function     | Category              | Implementation                        |
|--------------|-----------------------|---------------------------------------|
| Identify     | Asset Management      | IaC defines all resources             |
| Protect      | Access Control        | Managed Identity, RBAC, Key Vault     |
| Protect      | Data Security         | TLS, client-side storage, no server DB|
| Detect       | Continuous Monitoring | Log Analytics, health checks          |
| Respond      | Response Planning     | Centralized logging for investigation |
| Recover      | Recovery Planning     | IaC enables rapid redeployment        |

---

## 9. Threat Model

### 9.1 STRIDE Analysis

| Threat                    | Risk   | Mitigation                              |
|---------------------------|--------|----------------------------------------|
| Spoofing                  | Low    | HTTPS only, no user auth required       |
| Tampering                 | Low    | TLS encryption, input validation        |
| Repudiation               | Low    | Structured logging to Log Analytics     |
| Information Disclosure    | Medium | Key Vault, no PII logging, client data  |
| Denial of Service         | Medium | Azure DDoS protection, autoscaling      |
| Elevation of Privilege    | Low    | Non-root, no-new-privileges, no caps    |

### 9.2 Attack Vectors and Mitigations

```
+=====================================================================+
|                      ATTACK SURFACE ANALYSIS                        |
+=====================================================================+
|                                                                     |
|  EXTERNAL ATTACK VECTORS                                            |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [Internet] --> [HTTPS Endpoint]                              |  |
|  |                        |                                      |  |
|  |                        +-- XSS Attack                         |  |
|  |                        |   Mitigation: CSP headers,           |  |
|  |                        |   React auto-escaping,               |  |
|  |                        |   X-Content-Type-Options             |  |
|  |                        |                                      |  |
|  |                        +-- CSRF Attack                        |  |
|  |                        |   Mitigation: No session cookies,    |  |
|  |                        |   stateless API design               |  |
|  |                        |                                      |  |
|  |                        +-- Injection Attack                   |  |
|  |                        |   Mitigation: Zod validation, CSP    |  |
|  |                        |                                      |  |
|  |                        +-- DDoS Attack                        |  |
|  |                        |   Mitigation: Azure infra, scaling   |  |
|  |                        |                                      |  |
|  |                        +-- Malicious File Upload              |  |
|  |                            Mitigation: Type/size validation   |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  INTERNAL ATTACK VECTORS                                            |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [Container] --> [Azure Resources]                            |  |
|  |                        |                                      |  |
|  |                        +-- Credential Theft                   |  |
|  |                        |   Mitigation: Managed ID (no creds)  |  |
|  |                        |                                      |  |
|  |                        +-- Container Escape                   |  |
|  |                        |   Mitigation: Non-root, no caps      |  |
|  |                        |                                      |  |
|  |                        +-- Lateral Movement                   |  |
|  |                            Mitigation: Single container       |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  SUPPLY CHAIN ATTACK VECTORS                                        |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [npm packages] --> [Build Process]                           |  |
|  |                           |                                   |  |
|  |                           +-- Malicious Dependency            |  |
|  |                           |   Mitigation: npm audit, lockfile |  |
|  |                           |                                   |  |
|  |                           +-- Compromised Base Image          |  |
|  |                           |   Mitigation: Official Alpine     |  |
|  |                           |                                   |  |
|  |                           +-- Build Injection                 |  |
|  |                               Mitigation: Multi-stage, CI/CD  |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+=====================================================================+
```

---

## 10. Security Hardening Checklist

### 10.1 Pre-Deployment Checklist

| Item                                              | Required | Status |
|---------------------------------------------------|----------|--------|
| npm audit shows no high/critical vulnerabilities  | Yes      | [ ]    |
| All secrets stored in Key Vault                   | Yes      | [ ]    |
| CORS policy configured (disabled or restricted)   | Yes      | [x]    |
| Content-Security-Policy header configured         | Yes      | [x]    |
| Container runs as non-root user                   | Yes      | [x]    |
| Health check endpoints configured                 | Yes      | [x]    |
| TLS certificate valid and auto-renewed            | Yes      | [ ]    |
| Log Analytics workspace configured                | Yes      | [ ]    |
| Resource tags applied for governance              | Yes      | [x]    |

### 10.2 Production Configuration Recommendations

```bicep
// Recommended production settings

// Container App - internal ingress with Front Door
externalIngress: false  // Use Azure Front Door for public access

// Key Vault - enable purge protection
enablePurgeProtection: true

// Container Registry - Premium for security features
sku: 'Premium'

// Log Analytics - extend retention
retentionInDays: 90
```

### 10.3 Optional Security Enhancements

| Enhancement            | Description                       | Priority |
|------------------------|-----------------------------------|----------|
| Azure Front Door + WAF | Edge protection, DDoS mitigation  | High     |
| Private Endpoints      | Remove public network access      | Medium   |
| Azure Defender         | Threat detection for containers   | Medium   |
| VNet Integration       | Network isolation                 | Medium   |
| Egress Firewall Rules  | Enforce network-level egress restrictions to Azure OpenAI only | Medium |
| Image Signing          | Container image verification      | Low      |

**Implemented Security Controls (v1.2):**

The following security controls have been implemented:

- **Content-Security-Policy (CSP)**: Comprehensive CSP header configured in `next.config.mjs` and `middleware.ts`
  - Restricts script, style, image, media, and connection sources
  - Blocks mixed content and enforces upgrade-insecure-requests
  - Prevents clickjacking via frame-ancestors directive

- **CORS Policy**: Configurable via `corsAllowedOrigins` parameter in Bicep
  - Default: CORS disabled (most restrictive)
  - Can be configured to specific domains if cross-origin access is required

---

## 11. Appendices

### 11.1 Glossary

| Term              | Definition                                           |
|-------------------|------------------------------------------------------|
| Container App     | Azure's serverless container hosting service         |
| Managed Identity  | Azure AD identity for resources (no credentials)     |
| IndexedDB         | Browser-based NoSQL database for client storage      |
| Alpine Linux      | Minimal Linux distribution (~5MB) for containers     |
| dumb-init         | Minimal init system for proper signal handling       |
| Bicep             | Azure's infrastructure-as-code language              |
| GPT-4o Transcribe | Azure OpenAI speech-to-text model with diarization   |

### 11.2 File References

| File                            | Purpose                             |
|---------------------------------|-------------------------------------|
| /Dockerfile                     | Container build definition          |
| /docker-compose.yml             | Local development orchestration     |
| /infrastructure/main.bicep      | Azure infrastructure definition     |
| /infrastructure/modules/*.bicep | Modular Azure resources             |
| /next.config.mjs                | Security headers configuration      |
| /app/api/health/route.ts        | Health check endpoint               |
| /app/api/transcribe/route.ts    | Transcription API endpoint          |
| /lib/openai.ts                  | Azure OpenAI client configuration   |

### 11.3 Contact Information

| Role                 | Contact        |
|----------------------|----------------|
| Application Owner    | [To be filled] |
| Security Contact     | [To be filled] |
| Infrastructure Team  | [To be filled] |

---

## Document Approval

| Role                 | Name | Date | Signature |
|----------------------|------|------|-----------|
| Application Owner    |      |      |           |
| Security Reviewer    |      |      |           |
| Infrastructure Lead  |      |      |           |

---

*This document should be reviewed and updated with each major release or infrastructure change.*
