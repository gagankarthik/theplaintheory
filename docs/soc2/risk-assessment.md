# Risk assessment

| | |
| --- | --- |
| Owner | Security lead `[owner]` |
| Review | Annually, and when the product, infrastructure, vendors or regulations change significantly |
| Criteria | CC3.1, CC3.2, CC3.3, CC3.4, CC9.1 |

## Method

1. **Identify** threats to our service commitments (security, availability, confidentiality of
   consent data), including fraud and insider risk (CC3.3) and changes in the business or regulation (CC3.4).
2. **Rate** each risk for likelihood (1 rare to 5 almost certain) and impact (1 minor to 5 severe:
   regulatory penalty, loss of customer evidence, or major outage). Score = likelihood × impact.
3. **Treat** each risk: mitigate (link the control), transfer (insurance or contract), accept (CEO
   sign-off when the score is 12 or more), or avoid.
4. **Record** the residual score, the owner and the next review date. Accepted risks are re-approved yearly.

## Register

Initial assessment `[date]`. Scores are residual, after the listed controls.

| # | Risk | L | I | Score | Treatment / controls |
| --- | --- | --- | --- | --- | --- |
| R1 | Customer account takeover through a stolen password | 2 | 4 | 8 | MFA with an org-wide requirement (AC-02/03), lockout (AC-06), password policy (AC-05), session revocation (AC-04) |
| R2 | Consent records altered or deleted, by an attacker or an insider | 1 | 5 | 5 | Hash chains with verification (CON-04), audit trail (MON-01), KMS, least-privilege AWS access (AC-10), S3 object lock (AV-02) |
| R3 | Audit trail altered to hide activity | 1 | 4 | 4 | Hash chain, fails closed, verification on demand and monthly (MON-02); the head hash is included in exports, so truncation is visible against an earlier export |
| R4 | Secret leak (session secret, MFA key, cloud keys) | 2 | 5 | 10 | Secrets manager, gitleaks in CI (AC-14), rotation runbook; sessions and MFA secrets can be re-keyed |
| R5 | Vulnerable dependency exploited | 3 | 3 | 9 | Dependabot, `npm audit` gate, patch SLA (MON-05) |
| R6 | Personal data kept longer than allowed | 2 | 3 | 6 | Retention job (CON-02); **open item:** the S3 archive's 2-year object lock exceeds Free and Starter plan retention (see the retention policy) |
| R7 | Regional AWS outage | 2 | 3 | 6 | CDN-served banners, PITR, IaC (AV-01, VEN-02); residency prevents cross-region failover by design |
| R8 | Malicious or careless insider with production access | 2 | 4 | 8 | Least privilege, quarterly reviews (AC-08), CloudTrail, PR review (CHG-01) |
| R9 | Small team: one engineer reviews their own change | 3 | 3 | 9 | Separation-of-duties rule with external or CEO review for sensitive changes (CHG-01); **accepted until the team grows** |
| R10 | Breach notification missed or late | 2 | 4 | 8 | Incident response plan with a 72-hour path and annual tabletop (MON-04) |
| R11 | Phishing or malware on a staff laptop | 3 | 3 | 9 | MDM, disk encryption, hardware security keys for admins, training (ORG-03) |
| R12 | Fraudulent signups abusing the free tier, or SSRF via the scanner | 2 | 2 | 4 | Rate limits, SSRF guard (AC-11) |
| R13 | A regulation changes (DPDP Rules, EU AI Act, US state laws) | 3 | 3 | 9 | Regulatory watch by the DPO; product roadmap review quarterly |

## Fraud risk (CC3.3)

Covered above by R2, R8 and R12, and by billing controls in Stripe (refunds and plan changes are
recorded as `billing.plan_changed` audit events with actor `system:stripe`).
