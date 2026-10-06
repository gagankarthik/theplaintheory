# Business continuity and disaster recovery

| | |
| --- | --- |
| Owner | Engineering lead `[owner]` |
| Review | Annually, with the restore test |
| Criteria | A1.1, A1.2, A1.3, CC9.1 |

## Objectives

| Service | Recovery time objective (RTO) | Recovery point objective (RPO) |
| --- | --- | --- |
| Banner delivery (`plain-consent.js` and published configs on CloudFront) | 1 hour | Last publish |
| Consent API (`/api/v1/*`) | 4 hours | 5 minutes |
| Dashboard | 8 hours | 5 minutes |

The banner keeps working from the CDN cache if the API is down. Visitors still get a notice, but
receipts won't be recorded until the API returns. This is the main degraded mode.

## Protections in place

- **DynamoDB:** point-in-time recovery (35 days), deletion protection, `RETAIN` removal policy, and a
  customer-managed KMS key with yearly rotation (`infra/lib/data-stack.ts`).
- **Receipt archive (optional):** a Kinesis stream to S3 with object lock and KMS (`infra/lib/archive.ts`),
  giving an independent copy of every receipt.
- **Static assets and published configs:** in S3 behind CloudFront; reproducible from `main`
  with `npm run sdk:build` and a republish.
- **Infrastructure as code:** the whole stack (`infra/`) can be redeployed into a new account or region.
- **Source:** GitHub, with local clones on engineers' machines.

## Restore procedure (DynamoDB)

1. Pick the restore time, just before the incident.
2. `aws dynamodb restore-table-to-point-in-time --source-table-name plain-theory-<stage> --target-table-name plain-theory-<stage>-restore --restore-date-time <iso>`
3. Verify data: run chain verification for each site (`verifyChain` from its checkpoint) and the audit
   trail (`verifyAuditChain`) against the restored table. Intact chains show the restore is complete
   and unaltered.
4. Point the app at the restored table (`DYNAMO_TABLE`), or copy the affected items back.
5. Record timings against the RTO and RPO.

## Region failure

Customer data stays in the customer's chosen region (data residency), so we don't fail over to another
region automatically. For a regional outage: keep serving banners from CloudFront, tell affected
customers, and restore in-region when AWS recovers. Moving data to another region needs the
customer's consent.

## Testing

- **Annually:** a restore test using the procedure above into a scratch table, with the verification
  results and timings recorded.
- **Annually:** a tabletop of a regional outage and a ransomware or deletion scenario, held jointly
  with the incident response exercise.

## People

If a key person is unavailable, at least two people hold AWS break-glass access (stored in the company
password manager, with MFA hardware keys) and know this procedure.
