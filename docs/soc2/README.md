# SOC 2 readiness

Plain Theory is preparing for a **SOC 2 Type II** examination against the Trust Services Criteria
(Security, plus Confidentiality, Availability and Privacy where they apply). SOC 2 is an attestation
by an independent CPA firm. Neither this repository nor the product can make us "SOC 2 compliant"
on their own. Until a report is issued, public copy says **"SOC 2 Type II in preparation"** and
nothing stronger.

A Type II report covers how controls *operated over a period* (usually 3 to 12 months), not just how
they're designed. Most of the work below is therefore about producing evidence continuously:
audit events, access reviews, change records, incident records, and signed policy acknowledgements.

## What's in this folder

| Document | Criteria | Purpose |
| --- | --- | --- |
| [control-matrix.md](control-matrix.md) | All | Each criterion mapped to the control, its implementation, the evidence, the owner and how often it runs |
| [information-security-policy.md](information-security-policy.md) | CC1, CC2, CC5 | The umbrella policy: scope, roles, how the other policies are approved and reviewed |
| [access-control-policy.md](access-control-policy.md) | CC6.1–CC6.3, CC6.6 | Roles, MFA, sessions, joiners/movers/leavers, quarterly access reviews |
| [change-management-policy.md](change-management-policy.md) | CC8.1 | Pull requests, review, CI gates, deploys, emergency changes |
| [secure-sdlc.md](secure-sdlc.md) | CC8.1, CC7.1 | Secure coding standards, dependency and secret scanning, security testing |
| [incident-response-plan.md](incident-response-plan.md) | CC7.3–CC7.5 | Detection, triage, containment, 72-hour notification (DPDP Rule 7, GDPR Art. 33) |
| [vendor-management-policy.md](vendor-management-policy.md) | CC9.2 | Subprocessor inventory and annual review |
| [data-retention-and-disposal-policy.md](data-retention-and-disposal-policy.md) | C1.1, C1.2, P4.2 | Retention periods by data type and the automated disposal job |
| [business-continuity-and-dr.md](business-continuity-and-dr.md) | A1.2, A1.3 | Backups, RPO/RTO, restore testing |
| [risk-assessment.md](risk-assessment.md) | CC3.1–CC3.4, CC9.1 | Annual risk assessment method and the current risk register |
| [acceptable-use-policy.md](acceptable-use-policy.md) | CC1.1, CC2.2 | What staff and contractors may and may not do with company systems and data |

## Controls the product implements

These run in code and can be checked live by an owner or admin at **/app/security** in the dashboard:

- **Audit trail** (CC4.1, CC7.2): every sign-in, failed sign-in, lockout, MFA change, session
  revocation, role or membership change, settings change, publish, banner, tracker, language and
  webhook change, export, chain verification, plan change and retention run is written to a per-organization,
  hash-chained log (`src/lib/audit.ts`, `src/lib/audit-chain.ts`). Owners and admins can filter, verify
  and export it at **/app/audit**. Writes fail closed: if the event can't be recorded, the change fails.
- **Two-factor sign-in** (CC6.1): TOTP (RFC 6238) with single-use recovery codes, encrypted at rest
  (`src/lib/auth/totp.ts`, `mfa.ts`, `secret-box.ts`). Owners can require it organization-wide.
- **Sessions** (CC6.1): server-side session records, a 30-minute idle timeout, a 12-hour absolute
  lifetime, the session id rotated at sign-in, MFA and password change, and user-visible revocation
  (`src/lib/auth/session.ts`, `token.ts`, `src/proxy.ts`).
- **Authentication hardening** (CC6.1): a 12-character minimum with common-password and email-name
  checks, account lockout (5 failures in 15 minutes locks for 15 minutes), per-network throttling,
  generic errors and constant-time comparisons (`src/lib/auth/provider.ts`, `lockout.ts`, `password-policy.ts`).
- **Access reviews** (CC6.2, CC6.3): a one-click CSV of members, roles, MFA status, last activity and
  who granted access (**Team › Export access review**), with every export audited.
- **Retention and disposal** (C1.2, P4.2): a daily job removes data past its retention period, keeping
  consent-log tamper evidence intact with a checkpoint (`src/lib/retention.ts`, `npm run retention`).
- **Security headers and CI gates** (CC6.7, CC8.1): CSP, HSTS, frame-ancestors none, no-store on app
  pages (`next.config.ts`); lint, type check, tests, build, `npm audit` and secret scanning on every
  pull request (`.github/workflows/ci.yml`).

## What the company still has to do

None of these can be done in code. Each one needs an owner and a calendar entry.

1. **Pick an auditor and a readiness window.** Most firms recommend a readiness assessment, then a
   Type I (point in time), then a Type II observation period of at least 3 months.
2. **Approve and publish these policies.** Fill in the owner names marked `[owner]`, have the CEO
   approve them, and collect signed acknowledgements from every employee and contractor at onboarding
   and annually.
3. **Run the recurring controls and keep the evidence.** These are the quarterly access reviews,
   annual risk assessment, annual vendor review, annual restore test, annual incident tabletop,
   and security awareness training. The [control matrix](control-matrix.md) lists the frequency for each.
4. **HR controls.** Background checks where lawful, confidentiality agreements, and onboarding and
   offboarding checklists that include revoking access within 24 hours.
5. **Endpoint and cloud baseline.** Disk encryption, screen lock and OS updates on company laptops
   (MDM), MFA on AWS, GitHub, Stripe and Google Workspace, and AWS CloudTrail with GuardDuty on
   every account.
6. **Production configuration.** Set `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `INTERNAL_CRON_SECRET`
   and `IP_HASH_SALT` from a secrets manager. Schedule `POST /api/internal/retention` daily. Turn on
   "Require two-factor" for the company's own organization.
7. **Penetration test.** Commission an independent test before the observation period and fix
   high and critical findings.

## Running the checks locally

```bash
npm test                 # unit tests: TOTP vectors, chains, lockout, policy, retention
npm run seed             # demo data with audit events, sessions and an MFA-enabled admin
npm run retention -- --dry-run
npm run retention        # against the running dev server
```
