# Change management policy

| | |
| --- | --- |
| Owner | Engineering lead `[owner]` |
| Review | Annually |
| Criteria | CC8.1, CC7.1 |

## Scope

Application code, the consent script and packages, infrastructure (`infra/`, AWS CDK), CI
configuration, production configuration and secrets, and database or data migrations.

## Standard changes

1. **Branch and pull request.** All changes reach `main` through a pull request. Direct pushes to
   `main` are blocked by branch protection, including for admins.
2. **Description.** The PR says what changed, why, how it was tested, and any security or privacy
   impact (new data collected, new subprocessor, changed access).
3. **Review.** At least one approving review from someone other than the author. Changes to
   authentication, sessions, RBAC, the audit trail, cryptography, retention or `infra/` also need
   review from the Security lead or Engineering lead.
4. **Automated checks must pass** (`.github/workflows/ci.yml`): lint, type check, unit tests, the SDK
   build and its 10 KB budget, the production build, `npm audit --audit-level=high` and gitleaks secret
   scanning. Required status checks are enforced by branch protection.
5. **Deploy.** Production is deployed only from `main`, by the pipeline. Infrastructure changes go
   through `cdk diff` in the PR and `cdk deploy` from `main`.
6. **Verify.** The author checks the change in production and watches error rates for 30 minutes.

## Emergency changes

When production is down or under active attack, the on-call engineer may deploy a fix without prior
review, but CI must still pass. A PR is opened (or the existing one completed) and reviewed within
**one business day**. The incident record links to it.

## Separation of duties

Nobody approves their own pull request. In a team of one or two engineers, the CEO or an external
reviewer approves security-sensitive changes, and the gap is recorded in the risk register.

## Dependencies

Dependabot opens weekly update PRs. They follow the same review and CI process. Critical security
updates are merged within 7 days and high within 30 (the same SLA as [SECURITY.md](../../SECURITY.md)).

## Evidence

GitHub PR history (author, reviewer, CI result, merge time), deploy logs, and incident records for
emergency changes. The auditor will sample PRs across the observation period.
