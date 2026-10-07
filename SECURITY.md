# Security policy

## Reporting a vulnerability

Email **security@theplaintheory.in** with a description, steps to reproduce and the affected URL or component. Please don't open a public issue.

- We acknowledge reports within 2 business days.
- We give you an initial assessment within 5 business days.
- We aim to fix critical issues within 7 days and high-severity issues within 30 days, and we'll tell you when the fix ships.
- We won't take legal action against good-faith research that avoids privacy violations, data destruction and service disruption, and that gives us reasonable time to fix the issue before disclosure.

## Scope

In scope: theplaintheory.in, the dashboard, the public consent API (`/api/v1/*`), the consent script (`plain-consent.js`) and the framework packages in `packages/`.

Out of scope: denial-of-service testing, social engineering, physical attacks, and reports from automated scanners without a demonstrated impact.

## Supported versions

Only the latest release of the consent script and the packages receives security fixes.
