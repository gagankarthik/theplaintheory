# Acceptable use policy

| | |
| --- | --- |
| Owner | Security lead `[owner]` |
| Applies to | All employees and contractors |
| Review | Annually; acknowledged at hire and every year |
| Criteria | CC1.1, CC2.2, CC6.8 |

## Devices

- Use a company-managed device (MDM-enrolled, full-disk encryption, screen lock within 5 minutes,
  automatic OS updates, endpoint protection) to access production, source code or customer data.
- Don't share devices or accounts. Report a lost or stolen device to the Security lead **immediately**.

## Accounts and credentials

- Use the company password manager. Use unique passwords. Turn on MFA everywhere it's offered, and use
  hardware security keys for admin accounts.
- Never share credentials, session links or MFA codes, including with colleagues or "IT support".
- Never put secrets in source code, tickets, chat, documents or AI tools. If one is exposed, report it
  so it can be rotated.

## Customer data

- Access customer data only to do your job (support, debugging an incident) and only through
  approved tools. Don't browse it out of curiosity. The audit trail and CloudTrail record access.
- Don't copy customer data to personal devices, personal cloud storage, or third-party services that
  aren't on the vendor register. That includes AI assistants unless they're approved for that data.
- Use the seeded demo data (`npm run seed`) for development and screenshots, never production data.

## Communication and AI tools

- Discuss company business only on approved tools (Google Workspace, GitHub, the company chat).
- AI coding assistants may be used on source code. Never paste customer data, secrets or production
  logs into them.

## Prohibited

Bypassing security controls, installing unapproved software that runs with elevated privileges,
testing security against systems we don't own, and using company systems for illegal activity or
harassment.

## Reporting

Report suspected incidents, phishing and policy breaches to `security@theplaintheory.com` without
delay. Good-faith reports are never penalised.

---

I have read and will follow this policy.

Name: ____________________ Signature: ____________________ Date: __________
