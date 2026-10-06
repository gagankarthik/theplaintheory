# Data retention and disposal policy

| | |
| --- | --- |
| Owner | Engineering lead `[owner]` |
| Review | Annually |
| Criteria | C1.1, C1.2, P4.2, P4.3 |

## Retention schedule

| Data | Retention | How it's removed |
| --- | --- | --- |
| Consent receipts | The plan's `logRetentionDays`: Free 90 days, Starter 365, Growth 730, Business 2,555 (7 years), Enterprise 3,650 | Daily retention job, oldest first, with a checkpoint (below) |
| Consent receipt archive (S3, when enabled) | At least 2 years (object lock, governance mode), then per plan | S3 lifecycle; object lock prevents earlier deletion |
| Leak reports (tracker requests seen after a decline) | 90 days | Daily retention job |
| Webhook delivery logs | 30 days | Daily retention job |
| Administrative audit trail | **At least 1 year**; kept for the life of the organization today | Never removed by the retention job |
| Session records | 30 days after the session ends | Pruned on write (local) / DynamoDB TTL |
| MFA challenge cookie | 5 minutes | Expires |
| Pageview counters (aggregates, no personal data) | Life of the site | Deleted with the site |
| Customer account data | Life of the account, then 30 days | Account deletion process |
| Backups (DynamoDB PITR) | 35 days rolling | AWS-managed |

**Important:** when the S3 archive is enabled, the 2-year object lock keeps archived receipts longer
than the Free (90-day) and Starter (365-day) plan periods. Either lower the object-lock period for
those tiers, or state the archive period in the customer DPA and the retention table on the
marketing site. Decide this before the observation period.

## How the retention job works

`src/lib/retention.ts`, run daily through `POST /api/internal/retention`
(`Authorization: Bearer $INTERNAL_CRON_SECRET`), or `npm run retention` against a running app.
`?dryRun=1` and `--dry-run` report without deleting.

For each organization and site:

1. **Verify first.** The consent chain is verified. If it's broken, nothing is deleted: a break is
   evidence of tampering, so the site is reported as skipped and handled under the
   [incident response plan](incident-response-plan.md).
2. **Checkpoint, then delete.** Receipts older than the plan's period are removed oldest-first,
   stopping at the first receipt still in its period. Before deleting, the job writes a **retention
   checkpoint** on the site with the last removed seq and hash, the time it covers up to, and the
   running total. Verification then starts from that hash, so the remaining chain still proves
   nothing was altered. A run interrupted between the two steps still verifies, and the next run
   finishes the deletion.
3. **Leak reports and webhook logs** past their periods are removed.
4. **Record.** Each organization gets a `retention.run` audit event (actor `system:retention`)
   with counts, and `retentionLastRunAt` is updated.

The Evidence Pack includes a `retention` section with the plan period and the checkpoint, so an
auditor or regulator can see that missing early receipts were removed by policy, not lost.
The /app/security page flags an organization whose retention job hasn't run in 48 hours.

## Disposal of other media

- Company laptops are wiped (cryptographic erase with FileVault or BitLocker) before reuse or disposal.
- No customer data on removable media or personal devices.
- When an account is closed, its data is deleted within 30 days. Backups roll off within 35 days after that.

## Legal holds

The Security lead can suspend deletion for a specific organization when a legal claim, regulator
request or investigation requires it. Record the hold with a reason and review date, then exclude the
organization from the job until the hold is lifted.
