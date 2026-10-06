# Incident response plan

| | |
| --- | --- |
| Owner | Security lead `[owner]` (incident commander by default) |
| Review | Annually, after every Sev 1, and after the annual tabletop exercise |
| Criteria | CC7.3, CC7.4, CC7.5, CC2.3 |

## What counts as an incident

Any event that threatens the confidentiality, integrity or availability of customer data or of our
systems. For example:

- unauthorised access to an account, AWS, GitHub or the database;
- a broken hash chain on the audit trail or a consent log (a "Broken at" verdict);
- leaked secrets (session secret, MFA key, Stripe or AWS keys);
- a vulnerability report showing data exposure;
- loss of availability of the consent API or banner delivery;
- a lost or stolen laptop with access to company systems.

Anyone who suspects an incident reports it immediately to `security@theplaintheory.com` and the
Security lead by phone or chat. Don't investigate alone, and don't delete anything.

## Severity

| Sev | Definition | Response |
| --- | --- | --- |
| 1 | Confirmed or likely personal data breach; production compromise; tampered audit or consent chain | Incident commander within 1 hour, around the clock |
| 2 | Credible threat without confirmed data access; major outage of the consent API | Within 4 hours |
| 3 | Limited impact, contained, no personal data affected | Next business day |

## Phases

1. **Detect and triage.** Sources include CloudWatch alarms, GuardDuty, chain verification,
   `auth.locked` spikes in the audit log, customer reports and `SECURITY.md` reports. The incident
   commander opens an incident record (time detected, reporter, initial severity) and a private channel.
2. **Contain.** Revoke sessions (Account › Sign out everywhere else, or for a user by revoking their
   session records), disable compromised accounts, rotate affected secrets, and block abusive networks.
   Preserve evidence first: snapshot the DynamoDB table (PITR), export the audit trail CSV with its
   chain verdict, and keep CloudTrail logs.
3. **Assess.** Work out what data, which customers, which data principals, and the time window. Hash
   chains show exactly which records were altered or removed.
4. **Notify** (see below).
5. **Eradicate and recover.** Fix the root cause through an emergency change
   ([change-management-policy.md](change-management-policy.md)), restore from backup if needed
   ([business-continuity-and-dr.md](business-continuity-and-dr.md)), and verify chains again.
6. **Review.** Hold a blameless post-incident review within 5 business days covering the timeline,
   root cause, what worked, and actions with owners. Update the risk register.

## Notification

The clock starts when we become **aware** of a personal data breach.

| Who | When | Basis |
| --- | --- | --- |
| Affected customers (our customers are the data fiduciaries / controllers) | Without undue delay, and early enough for them to meet their own deadlines; aim for 24 hours | Customer DPA; GDPR Art. 33(2) (processor to controller) |
| Data Protection Board of India (where we act as data fiduciary, e.g. our own account data) | Intimation **without delay**, and a detailed report **within 72 hours** | DPDP Rules 2025, Rule 7 |
| Affected data principals in India (where we're the fiduciary) | Without delay, in plain language: what happened, likely consequences, mitigation, contact | DPDP Rules 2025, Rule 7(1) |
| Lead EU supervisory authority (where we're the controller) | **Within 72 hours**, unless unlikely to result in risk | GDPR Art. 33 |
| Data subjects in the EU | Without undue delay where there's high risk | GDPR Art. 34 |
| California residents / Attorney General | As required by Cal. Civ. Code §1798.82 | CCPA / state law |

The notice includes the nature of the breach, the categories and approximate numbers of people and
records, likely consequences, measures taken, and a contact point (the DPO). Templates live in the
incident runbook. Every notification sent, and the reason for any decision not to notify, goes in the
incident record.

## Evidence

Incident records, post-incident reviews, notification copies, and the annual tabletop exercise
(scenario, attendees, gaps found, actions).
