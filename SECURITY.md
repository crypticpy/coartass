# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest| :x:                |

## Reporting a Vulnerability

We take the security of Austin RTASS seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please use **GitHub Security Advisories**:

1. Go to the repository's **Security** tab
2. Click **Report a vulnerability**
3. Fill out the security advisory form with:
   - **Type of issue** (e.g., XSS, injection, authentication bypass, etc.)
   - **Affected files/components** with paths
   - **Steps to reproduce** the issue
   - **Proof-of-concept** code (if possible)
   - **Impact assessment** - how an attacker might exploit it

This creates a private discussion where we can work together on a fix before public disclosure.

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Communication**: We will keep you informed of progress toward a fix
- **Disclosure**: We will coordinate disclosure timing with you
- **Credit**: We will credit you in release notes (unless you prefer anonymity)

## Security Architecture

### Data Privacy Model

This application is designed with privacy in mind:

- **All user data stays in the browser** - Transcripts, recordings, and analyses are stored in IndexedDB
- **No server-side persistence** - The server only processes requests, it doesn't store your data
- **API calls are transient** - Audio and text are sent to OpenAI for processing but not stored by this application

### What Data Leaves the Browser

| Data | Destination | Purpose |
|------|-------------|---------|
| Audio files | OpenAI API | Transcription |
| Transcript text | OpenAI API | Analysis & Chat |
| Configuration | Server | Validation |

**Note**: OpenAI's data retention policies apply to data sent to their API. Review their [data usage policies](https://openai.com/policies/api-data-usage-policies) for your compliance requirements.

## Production Security Checklist

Before deploying to production, verify the following:

### Environment & Secrets

- [ ] API keys are NOT committed to version control
- [ ] Using environment variables or Azure Key Vault for secrets
- [ ] Different API keys for development and production
- [ ] Key rotation schedule established

### Application Configuration

- [ ] `NODE_ENV=production` is set
- [ ] Debug logging is disabled
- [ ] Error messages don't expose internal details
- [ ] HTTPS is enforced (redirect HTTP → HTTPS)

### Docker & Infrastructure

- [ ] Running as non-root user (the Dockerfile does this by default)
- [ ] Container has no unnecessary capabilities
- [ ] Health checks are configured
- [ ] Resource limits are set (CPU, memory)
- [ ] Log rotation is configured

### Network & Access

- [ ] Application is behind a reverse proxy/load balancer
- [ ] CORS is configured for your domain only
- [ ] Rate limiting is implemented at the infrastructure level
- [ ] DDoS protection is in place (if public-facing)

### Monitoring & Response

- [ ] Application logs are collected and monitored
- [ ] Alerts configured for errors and anomalies
- [ ] Incident response plan documented
- [ ] Contact information for security issues established

## Security Best Practices

### Environment Variables

- **Never commit secrets** to version control
- Use `.env.local` for local development (it's in `.gitignore`)
- Use Azure Key Vault for production deployments
- Rotate API keys regularly

### Azure Key Vault Integration

The application supports Azure Key Vault for secure secrets management:

```bash
# Set the Key Vault URL
export AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
```

When deployed to Azure with Managed Identity enabled, secrets are loaded automatically:

- `azure-openai-api-key`
- `azure-openai-endpoint`

### Docker Security

Our Docker configuration follows security best practices:

- **Non-root user**: Application runs as `nextjs` user (UID 1001)
- **Minimal base image**: Alpine Linux with minimal attack surface
- **No unnecessary privileges**: `cap_drop: ALL` and `no-new-privileges: true`
- **Signal handling**: `dumb-init` for graceful shutdown
- **Health checks**: Built-in health monitoring at `/api/health`

### Rate Limiting

The application does **not** include built-in rate limiting. For production deployments, implement rate limiting at the infrastructure level:

- **Azure**: Use Azure Front Door or API Management
- **Nginx**: Use `limit_req_zone` and `limit_req`
- **Cloudflare**: Use Rate Limiting rules

Recommended limits:
- `/api/transcribe`: 10 requests/minute per IP
- `/api/analyze`: 20 requests/minute per IP
- `/api/chat`: 30 requests/minute per IP

## Security Headers

The application configures the following security headers:

```javascript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()'
}
```

## Compliance Considerations

### HIPAA

If processing Protected Health Information (PHI):

- Ensure your OpenAI agreement covers BAA requirements
- Azure OpenAI can be configured for HIPAA compliance
- Implement audit logging for all access
- Consider encrypting data at rest in IndexedDB

### GDPR

For EU users:

- Data stays in browser (IndexedDB) - user controls their data
- No server-side user tracking
- Clear data deletion path (clear browser storage)
- Review OpenAI's data processing terms

### SOC 2

For SOC 2 compliance:

- Use Azure OpenAI (SOC 2 certified)
- Implement centralized logging
- Document access controls
- Regular security reviews

**Disclaimer**: This guidance is informational only. Consult with your compliance team for specific requirements.

## Known Security Considerations

### FFmpeg WASM

The application uses FFmpeg WASM for client-side audio processing. This requires specific headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These are configured for FFmpeg-related routes in `next.config.mjs`.

### API Keys

- OpenAI API keys can incur significant costs if misused
- Monitor usage in your OpenAI/Azure dashboard
- Set spending limits and alerts
- Use separate keys for development and production

## Incident Response

If you discover that your deployment has been compromised:

1. **Rotate all API keys** immediately (Azure Portal or OpenAI dashboard)
2. **Revoke any managed identity access** if using Azure
3. **Review access logs** for suspicious activity
4. **Update all dependencies** to latest versions
5. **Check Key Vault access logs** if using Azure Key Vault
6. **Notify affected users** if applicable
7. **Document the incident** for compliance purposes

## Dependency Management

- **Dependabot**: Automatically updates dependencies
- **Security audits**: Run `npm audit` before deployments
- **Lock files**: `package-lock.json` ensures reproducible builds

To check for vulnerabilities:

```bash
npm audit
```

To fix automatically:

```bash
npm audit fix
```

---

Thank you for helping keep Austin RTASS and its users safe!
