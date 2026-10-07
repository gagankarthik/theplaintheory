# Control matrix

Each row maps a Trust Services Criterion to the control we operate, where it's implemented, the
evidence an auditor will sample, who owns it, and how often it runs. "Product" controls are enforced
in code; "Org" controls are company processes evidenced by records.

Owners are roles. Assign names in [information-security-policy.md](information-security-policy.md#roles).

## Control environment, communication, risk (CC1–CC3, CC5)

| ID | Criterion | Control | Type | Implementation | Evidence | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ORG-01 | CC1.1, CC2.2 | Staff acknowledge the security and acceptable use policies | Org | [information-security-policy.md](information-security-policy.md), [acceptable-use-policy.md](acceptable-use-policy.md) | Signed acknowledgements | CEO | At hire, then annually |
| ORG-02 | CC1.3, CC5.3 | Policies approved by management and reviewed yearly | Org | `docs/soc2/*` version history | Git history, approval record | Security lead | Annually |
| ORG-03 | CC1.4, CC2.2 | Security awareness training | Org | Training provider | Completion records | Security lead | At hire, then annually |
| ORG-04 | CC1.4 | Background checks and confidentiality agreements | Org | HR onboarding checklist | Signed NDA, check record | CEO | At hire |
| ORG-05 | CC2.3 | Security contact and disclosure policy published | Product | `SECURITY.md`, marketing `/security` | Public page | Security lead | Continuous |
| ORG-06 | CC3.1–CC3.4, CC9.1 | Annual risk assessment and risk register | Org | [risk-assessment.md](risk-assessment.md) | Dated register, treatment decisions | Security lead | Annually and on major change |

## Logical access (CC6)

| ID | Criterion | Control | Type | Implementation | Evidence | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC-01 | CC6.1 | Role-based access: owner, admin, editor, auditor, viewer; checked server-side on every page, action and API route | Product | `src/lib/auth/rbac.ts`, `access.ts`, `route-guard.ts` | Role matrix, code, audit events `member.role_changed` | Eng lead | Continuous |
| AC-02 | CC6.1 | Two-factor sign-in (TOTP) with single-use recovery codes; secrets AES-256-GCM encrypted at rest | Product | `src/lib/auth/totp.ts`, `mfa.ts`, `secret-box.ts`, `src/app/(auth)/login/verify` | `auth.mfa_enabled` events, access review MFA column | Eng lead | Continuous |
| AC-03 | CC6.1 | Organization can require MFA; un-enrolled members are blocked from the app and exports until they enrol | Product | `requireUser`, `guardOrg`, `guardProperty`, `src/app/app/layout.tsx`; Settings › Sign-in security | `org.security_updated` events, /app/security | Owner (customer); Security lead (our own org) | Continuous |
| AC-04 | CC6.1 | Sessions: server-side records, 30-minute idle and 12-hour absolute timeout, revocation, rotation at sign-in, MFA and password change | Product | `src/lib/auth/session.ts`, `token.ts`, `src/proxy.ts` | Account › Where you're signed in; `auth.session_revoked` events; tests | Eng lead | Continuous |
| AC-05 | CC6.1 | Password policy (12+ characters, common and email-name passwords refused), scrypt hashing | Product | `src/lib/auth/password-policy.ts`, `provider.ts`; Cognito pool policy (`infra/lib/auth-stack.ts`) | Tests, code | Eng lead | Continuous |
| AC-06 | CC6.1 | Lockout: 5 failures in 15 minutes locks the account for 15 minutes, plus per-network throttling; generic errors | Product | `src/lib/auth/lockout.ts`, `provider.ts` | `auth.login_failed`, `auth.locked` events | Eng lead | Continuous |
| AC-07 | CC6.2 | Access is granted only by invitation from an owner or admin, recording who invited | Product | `src/app/app/team/actions.ts` | `member.invited` and `member.joined` events; access review "invited_by" | Eng lead | Continuous |
| AC-08 | CC6.2, CC6.3 | Quarterly access review of every organization member, including our own production access | Org + Product | Team › Export access review (`/api/app/team/access-review`) | Signed CSV per quarter; `access_review.exported` events; /app/security check (90 days) | Security lead | Quarterly |
| AC-09 | CC6.2 | Leavers removed within 24 hours (app, AWS, GitHub, Stripe, Workspace) | Org | Offboarding checklist in [access-control-policy.md](access-control-policy.md) | Ticket with timestamps; `member.removed` events | CEO | Per leaver |
| AC-10 | CC6.3 | Least privilege: owners kept to a minimum; production AWS access via SSO roles, no long-lived keys | Org + Product | /app/security least-privilege check; AWS IAM Identity Center | Access review; IAM report | Security lead | Quarterly |
| AC-11 | CC6.6 | Public endpoints rate limited; origin checks; SSRF-safe scanner | Product | `src/app/api/v1/*`, `src/lib/scan.ts` | Code, tests | Eng lead | Continuous |
| AC-12 | CC6.7 | TLS everywhere; HSTS, CSP and other security headers | Product | `next.config.ts`, CloudFront config | Header scan | Eng lead | Continuous |
| AC-13 | CC6.1, CC6.7 | Encryption at rest with customer-managed KMS keys and yearly rotation | Product | `infra/lib/data-stack.ts`, `archive.ts` | CDK, AWS Config | Eng lead | Continuous |
| AC-14 | CC6.8 | Dependency and secret scanning block merges | Product | `.github/workflows/ci.yml` (npm audit, gitleaks), Dependabot | CI history | Eng lead | Every PR, weekly |

## Monitoring and incidents (CC4, CC7)

| ID | Criterion | Control | Type | Implementation | Evidence | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MON-01 | CC4.1, CC7.2 | Hash-chained, per-organization audit trail of administrative and security events; fails closed | Product | `src/lib/audit.ts`, `audit-chain.ts`, store `appendAudit` | /app/audit, CSV export with chain verdict | Eng lead | Continuous |
| MON-02 | CC4.1 | Audit chain and consent chains verified | Product + Org | "Verify chain" on /app/audit and each consent log; /app/security | `audit.chain_verified`, `logs.chain_verified` events | Security lead | Monthly, and before every audit sample |
| MON-03 | CC7.2 | Infrastructure monitoring: CloudTrail, GuardDuty, CloudWatch alarms on 5xx and auth failures | Org | AWS accounts | Alarm configuration, alert history | Eng lead | Continuous |
| MON-04 | CC7.3–CC7.5 | Incident response with severity levels, a 72-hour regulator notification path and post-incident review | Org | [incident-response-plan.md](incident-response-plan.md) | Incident records, post-mortems | Security lead | Per incident; tabletop annually |
| MON-05 | CC7.1 | Vulnerability management: Dependabot, `npm audit`, an annual penetration test, fixes within SLA | Org + Product | [secure-sdlc.md](secure-sdlc.md), `SECURITY.md` | Pen test report, fix PRs | Eng lead | Continuous; pen test annually |

## Change management (CC8)

| ID | Criterion | Control | Type | Implementation | Evidence | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CHG-01 | CC8.1 | Every change goes through a pull request with at least one approving review; `main` is protected | Org + Product | GitHub branch protection, [change-management-policy.md](change-management-policy.md) | PR history | Eng lead | Every change |
| CHG-02 | CC8.1 | CI must pass before merge: lint, types, tests, SDK budget, build, dependency audit, secret scan | Product | `.github/workflows/ci.yml` | CI runs | Eng lead | Every change |
| CHG-03 | CC8.1 | Infrastructure as code; production deploys only from `main` | Product | `infra/` (CDK) | Deploy logs | Eng lead | Every deploy |
| CHG-04 | CC8.1 | Emergency changes reviewed within 1 business day | Org | [change-management-policy.md](change-management-policy.md) | Retroactive PR review | Eng lead | Per emergency |

## Vendors and risk mitigation (CC9)

| ID | Criterion | Control | Type | Implementation | Evidence | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VEN-01 | CC9.2 | Subprocessor inventory with SOC 2 or ISO 27001 reports reviewed | Org | [vendor-management-policy.md](vendor-management-policy.md) | Vendor register, report review notes | Security lead | Annually |
| VEN-02 | CC9.1 | Business continuity and DR plan; restore tested | Org | [business-continuity-and-dr.md](business-continuity-and-dr.md) | Restore test record | Eng lead | Annually |

## Availability (A1)

| ID | Criterion | Control | Type | Implementation | Evidence | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AV-01 | A1.2 | DynamoDB point-in-time recovery (35 days), deletion protection, retain-on-delete | Product | `infra/lib/data-stack.ts` | CDK, AWS console | Eng lead | Continuous |
| AV-02 | A1.2 | Consent receipt archive in S3 with object lock (2-year governance mode) and KMS | Product | `infra/lib/archive.ts` | CDK, bucket configuration | Eng lead | Continuous |
| AV-03 | A1.3 | Restore test from PITR into a scratch table, with data verified by chain verification | Org | [business-continuity-and-dr.md](business-continuity-and-dr.md) | Test record with timings | Eng lead | Annually |

## Confidentiality and privacy (C1, P)

| ID | Criterion | Control | Type | Implementation | Evidence | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CON-01 | C1.1 | Visitor IPs truncated and salted-hashed before storage; never stored raw | Product | `src/lib/crypto.ts` `anonymizeIp` | Code, data sample | Eng lead | Continuous |
| CON-02 | C1.2, P4.2 | Daily retention job removes consent receipts past the plan's period (checkpointed), leak reports after 90 days and webhook logs after 30 days; audit events kept at least a year | Product | `src/lib/retention.ts`, `/api/internal/retention`, `npm run retention` | `retention.run` events, property `retentionCheckpoint`, Evidence Pack `retention` section | Eng lead | Daily |
| CON-03 | P4.2 | Session records pruned 30 days after expiry; MFA challenges expire in 5 minutes | Product | `src/lib/store/*` | Code | Eng lead | Continuous |
| CON-04 | PI1.4, CC7.2 | Tamper-evident consent receipts (hash chain) with exportable verification | Product | `src/lib/crypto.ts` `verifyChain`, Evidence Pack | Evidence Pack digest, CSV verdict | Eng lead | Continuous |
