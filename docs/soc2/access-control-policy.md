# Access control policy

| | |
| --- | --- |
| Owner | Security lead `[owner]` |
| Review | Annually |
| Criteria | CC6.1, CC6.2, CC6.3, CC6.6, CC6.7 |

## 1. In the product (customer accounts)

### Roles

| Role | Can do |
| --- | --- |
| Owner | Everything, including billing, security policy (require MFA), deleting the organization and transferring ownership |
| Admin | Add and delete sites; edit banners, regions, languages and trackers and publish; manage the team and settings; export consent logs and Evidence Packs; read the audit log, security status and access reviews. Can't change or remove owners. No billing or security policy |
| Editor | Edit banners, regions, languages, trackers and webhooks, and publish. Can't add or delete sites, export logs, read the audit log or manage the team |
| Auditor | Read-only access to sites, analytics and banners; export consent logs and Evidence Packs; read the audit log, security status and access reviews. Can't change anything |
| Viewer | See sites, analytics and banners, and export consent logs and Evidence Packs. Can't change anything |

Permissions are checked on the server for every page, server action and API route
(`src/lib/auth/rbac.ts`, `access.ts`, `route-guard.ts`). The client never decides access.

### Authentication

- **Passwords:** at least 12 and at most 128 characters. Passwords that are common, simple sequences
  or repeated characters, or that contain the email's local part, are refused. Hashed with scrypt
  (random 16-byte salt). There are no composition rules or forced periodic changes, in line with
  NIST SP 800-63B.
- **Lockout:** 5 failed attempts within 15 minutes lock the account for 15 minutes. Wrong MFA codes count
  too. Each network (salted hash of the truncated IP) gets 30 attempts per 15 minutes. Error messages
  never reveal whether an email has an account, and unknown emails take the same scrypt time.
- **Two-factor (TOTP):** RFC 6238 with SHA-1, 30-second steps, 6 digits, and a ±1 step window. A code
  can't be reused once accepted. Secrets are encrypted at rest with AES-256-GCM (`MFA_ENCRYPTION_KEY`).
  Ten single-use recovery codes are stored as SHA-256 hashes and shown once. Turning MFA off or
  regenerating recovery codes requires a current code.
- **Require MFA:** an owner can require two-factor for the whole organization. Members without it can
  sign in but are confined to the Account page until they enrol, and exports refuse with 403. An owner
  must enrol before they can turn this on, and nobody can turn MFA off while a membership requires it.
- **Cognito:** with `AUTH_DRIVER=cognito`, passwords are verified by the Cognito user pool (minimum
  length 12, `infra/lib/auth-stack.ts`). The app's own TOTP step, lockout and sessions still apply on
  top. The pool's `mfa` setting is `OPTIONAL` with TOTP only. Don't switch it to `REQUIRED` until the
  sign-in flow handles Cognito's `SOFTWARE_TOKEN_MFA` challenge; enforce MFA with the in-app
  requirement instead.

### Sessions

- The cookie (`pt_session`, HttpOnly, Secure in production, SameSite=Lax) carries a signed reference
  to a **server-side session record**. Every request checks the record, so revocation takes effect immediately.
- **Idle timeout:** 30 minutes. Activity slides the window forward.
- **Absolute lifetime:** 12 hours from sign-in, whatever the activity.
- **Rotation:** a new session id at sign-in, after the MFA step, on enrolling MFA and on password change.
- **Revocation:** users see their sessions on **Account** and can sign out any one or "everywhere else".
  A password change signs out every other session.
- The password step issues only a 5-minute, single-purpose MFA challenge cookie. It never grants a session.

### Audit

Every authentication event, MFA change, session revocation, role and membership change is written to
the organization's hash-chained audit trail (see [control-matrix.md](control-matrix.md) MON-01).

## 2. Company systems (our staff)

| System | Requirement |
| --- | --- |
| AWS | IAM Identity Center (SSO) with MFA; no IAM users with console passwords; no long-lived access keys for people; production write access limited to the Engineering lead and one named backup |
| GitHub | Organization-enforced 2FA; `main` protected; admins limited to two people |
| Google Workspace | 2-step verification enforced; security keys for admins |
| Stripe | 2FA; restricted API keys per purpose |
| Plain Theory (our own org) | "Require two-factor" turned on |

## 3. Joiners, movers, leavers

### Joiners
1. A manager requests access by ticket, listing systems and role. The Security lead approves.
2. Access is granted at the lowest role that does the job. The product records who invited each member.
3. The confidentiality agreement and policy acknowledgement are signed first.

### Movers
Access is re-requested for the new role, and access the new role doesn't need is removed within 5 business days.

### Leavers
All access is removed **within 24 hours** of the last working day (immediately for involuntary
departures): product memberships, AWS, GitHub, Google Workspace, Stripe, password manager, and any
shared secrets the person knew are rotated. The ticket records the timestamps.

## 4. Access reviews (quarterly)

1. The Security lead exports **Team › Export access review** for our own organization, and reviews
   IAM Identity Center, GitHub and Workspace members.
2. For each person: still employed, role still right, MFA on, last active date reasonable. Fill
   `reviewer_decision` (keep / change / remove) and `reviewer_notes` in the CSV.
3. Changes are made within 5 business days. The signed CSV and change tickets are filed as evidence.
4. The /app/security page shows "Needs attention" if no review has been exported in 90 days.
