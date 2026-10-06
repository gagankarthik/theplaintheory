# Secure software development lifecycle

| | |
| --- | --- |
| Owner | Engineering lead `[owner]` |
| Review | Annually |
| Criteria | CC8.1, CC7.1, CC6.8 |

## Design

- Features that touch personal data, authentication, access or cryptography get a short threat model
  in the PR or design doc: what's protected, from whom, how it could fail, and what's logged.
- New data fields need a reason, a retention period
  ([data-retention-and-disposal-policy.md](data-retention-and-disposal-policy.md)) and a classification.

## Coding standards

- **Validate at the edge.** Every server action and API route parses input with `zod`, and access is
  checked server-side with `requireUser` / `requireProperty` / `guardOrg` / `guardProperty`.
- **Audit mutations.** Every mutating action records an audit event (`recordAudit`) before
  returning, and audit failures fail the action. Never put secrets, tokens, codes or passwords in
  audit metadata (`src/lib/audit.ts` strips keys that look like them as a backstop).
- **Secrets.** Read secrets only from the environment. Never log them. Compare them in constant time
  (`timingSafeEqual`).
- **Crypto.** Use only `node:crypto` primitives already in `src/lib/crypto.ts`, `src/lib/auth/*`, and
  never write new algorithms. Use AES-256-GCM with random IVs, scrypt for passwords, and HMAC-SHA256
  for tokens (jose).
- **Output.** Escape everything rendered into the consent banner. CSV exports neutralise spreadsheet
  formulas (`src/lib/csv.ts`). Outbound requests from user input go through the SSRF guard
  (`src/lib/scan.ts`, `src/lib/webhooks.ts`).
- **Errors.** Show generic messages to users, especially for authentication. Log details server-side.

## Verification

| Check | Where | Blocking |
| --- | --- | --- |
| Lint (ESLint with Next.js rules) | CI | Yes |
| Type check | CI | Yes |
| Unit tests (`tests/`: TOTP vectors, chains, lockout, password policy, retention, store) | CI | Yes |
| Dependency audit (high and critical) | CI | Yes |
| Secret scanning (gitleaks) | CI | Yes |
| Dependency updates (Dependabot) | Weekly | Reviewed PRs |
| Independent penetration test | Annually and before the SOC 2 observation period | Findings tracked to closure |

## Vulnerability handling

Reports arrive through [SECURITY.md](../../SECURITY.md). Fix targets: critical in 7 days, high in
30 days, medium in 90 days. A vulnerability that may have exposed customer data is handled as an
incident ([incident-response-plan.md](incident-response-plan.md)).
