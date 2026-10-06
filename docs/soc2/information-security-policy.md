# Information security policy

| | |
| --- | --- |
| Owner | Security lead `[owner]` |
| Approved by | CEO `[name]`, `[date]` |
| Review | Annually, and after any significant change to the product, team or infrastructure |
| Criteria | CC1.1–CC1.5, CC2.1–CC2.3, CC5.1–CC5.3 |

## Purpose

Plain Theory stores consent records that our customers rely on as legal evidence under the DPDP Act,
GDPR and CCPA. This policy sets out how we protect the confidentiality, integrity and availability of
that data and of the systems that process it. Every other policy in `docs/soc2` sits under this one.

## Scope

All employees, contractors and anyone with access to:

- the production application, the consent API and the consent script;
- AWS accounts, GitHub, Stripe, Google Workspace and any other system holding customer data or source code;
- company laptops and phones used for work.

## Principles

1. **Least privilege.** People get the access their job needs, no more, and it's reviewed quarterly.
2. **Evidence by default.** Security-relevant actions leave a record (the product audit trail, CloudTrail,
   GitHub history) that can't be quietly altered.
3. **Minimise data.** We collect only what the service needs. Visitor IPs are truncated and hashed, and
   data is deleted when its retention period ends.
4. **Secure by default.** Safe defaults ship in code and are enforced in CI, rather than depending on
   someone remembering a checklist.

## Roles

| Role | Responsibilities | Person |
| --- | --- | --- |
| CEO | Approves policies, accepts risk, owns HR controls | `[name]` |
| Security lead | Owns this programme, the risk register, access reviews, incident response and vendor reviews | `[name]` |
| Engineering lead | Owns secure development, change management, infrastructure, backups and monitoring | `[name]` |
| All staff | Follow these policies, complete training, report incidents and suspected weaknesses immediately | Everyone |

In a small team one person may hold several roles, but nobody approves their own production change
(see [change-management-policy.md](change-management-policy.md)).

## Policy set

- [Access control](access-control-policy.md)
- [Change management](change-management-policy.md) and [secure SDLC](secure-sdlc.md)
- [Incident response](incident-response-plan.md)
- [Vendor management](vendor-management-policy.md)
- [Data retention and disposal](data-retention-and-disposal-policy.md)
- [Business continuity and disaster recovery](business-continuity-and-dr.md)
- [Risk assessment](risk-assessment.md)
- [Acceptable use](acceptable-use-policy.md)

## Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| **Restricted** | Session, MFA and webhook secrets; KMS keys; password hashes; Stripe keys | Secrets manager only; never in code, tickets or chat; rotated on suspected exposure |
| **Confidential** | Consent receipts, audit events, customer account data, Evidence Packs | Encrypted at rest and in transit; access by role; retained per the retention policy |
| **Internal** | Source code, runbooks, these policies | Company systems only |
| **Public** | Marketing site, docs, `SECURITY.md` | No restriction |

## Personnel security

- Background checks where lawful, and a signed confidentiality agreement before any access is granted.
- Policy acknowledgement and security awareness training at hire and every year after.
- Access removed within 24 hours of leaving (see [access-control-policy.md](access-control-policy.md#leavers)).

## Exceptions

Exceptions need written approval from the Security lead. They're recorded in the risk register with
an expiry date and reviewed at least quarterly.

## Enforcement

Breaching these policies may lead to access being withdrawn and to disciplinary action, in line with
employment and contractor agreements.
