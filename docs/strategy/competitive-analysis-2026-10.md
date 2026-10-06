# Competitive analysis and product strategy (October 2026)

Research date: 6 October 2026. Sources were vendor pricing and docs pages, regulator and law-firm pages, WordPress.org reviews, Hacker News, and Trustpilot/Capterra (summarised, re-check before quoting publicly). Reddit and G2 blocked automated access. Anything marked *unverified* comes from a single secondary source.

## Market in one paragraph

Global self-serve CMPs (Cookiebot, Usercentrics, CookieYes, Termly, iubenda, Complianz, Axeptio, Enzuzo) compete on price and WordPress distribution and have no real DPDP support. Enterprise suites (OneTrust, TrustArc, Didomi, Ketch, Transcend, Securiti) are sales-led and moving toward AI governance. India-native DPDP vendors (Privy by IDfy, Consentin by Leegality, Protean, Consently and a long tail) are sales-led or priced per consent and focused on BFSI. Nobody offers a self-serve, developer-grade product that covers GDPR, CPRA/GPC and DPDP together, and nobody sells verifiable proof that a banner actually worked.

## Competitor snapshot

| Vendor | Target | Entry paid price | DPDP support | Script weight | Proof |
|---|---|---|---|---|---|
| OneTrust | Enterprise | Quote; ~$10k/yr min (*unverified*) | Solution page, cites draft rules | 3.8 KB stub + 79.9 KB SDK + 17.3 KB JSON ([docs](https://developer.onetrust.com/onetrust/docs/performance-availability-cookie-script)) | Transaction DB |
| Cookiebot | SMB | €7 Lite, €15/mo per domain ([pricing](https://www.cookiebot.com/en/pricing/)) | Not listed | ~115 KB (*unverified*) | Consent log |
| Usercentrics | SMB to enterprise | €7/mo, 1.5k sessions | Blog only | "Up to 70% smaller" | Consent log |
| CookieYes | SMB, WordPress | $10/mo per domain + $0.30 per 1k overage | Blog only, no Indian languages | ~35 KiB (*unverified*) | CSV log |
| Osano | Mid-market | $199/mo | Generic article | 448 ms on Accept (*unverified*) | Logs |
| Didomi | Enterprise | Quote | 2023 explainer | No claim | Versioned UI proofs |
| TrustArc | Enterprise | Quote; ~$15k/yr (*unverified*) | DPDP template, 20+ Indian languages | No claim | Audit-ready records |
| Klaro | Developers | €19/mo hosted | None | ~57 kB ([GitHub](https://github.com/kiprotect/klaro)) | Audit log |
| Privy (IDfy) | Indian enterprise | Quote | Full stack; won NeGD Code for Consent (Jul 2026) | No claim | Yes |
| Consentin (Leegality) | Indian BFSI | Free to 3k consents/mo | 22 languages, withdrawal propagation | No claim | Audit trails |
| Consently | Indian SMB | ₹25k/yr for 5k consents + GST | 22 languages, Mumbai storage | No claim | Yes |

## What customers complain about (top 8)

1. Scripts hurt Core Web Vitals. OneTrust moved LCP from 1.43 s to 3.61 s in DebugBear's test.
2. Consent rates and analytics drop after install.
3. Free plans cut back after people depend on them ("bait and switch").
4. Surprise charges, automatic upgrades and hard cancellation.
5. Per-domain and per-page pricing punishes growth.
6. No support, even on paid plans.
7. Setup wizards and dashboards that confuse ("845 questions").
8. Banners that look compliant but leak trackers. One HN commenter found 7 in 10 sites leaking; Healthline ($1.55M), Tractor Supply ($1.35M, GPC) and Shein (€150M) were fined for exactly this.

## DPDP timeline that drives urgency

- Rules notified 13 Nov 2025.
- Consent Manager registration (Rule 4) from 13 Nov 2026.
- Notice, consent, withdrawal, security, breach, children and retention duties from 13 May 2027.
- A proposal to compress everything to 13 Nov 2026 was consulted on but not gazetted as of late September 2026.
- A consent management platform does not register with the Board. Only Consent Managers do, and using one is optional.

## Positioning

**The consent layer that proves itself.** One script under 10 KB for GDPR, CPRA and India's DPDP Act, with tamper-evident proof of every choice, at honest prices.

Three differentiators:

1. **Provable compliance.** SHA-256 hash-chained receipts that record the signals honoured (GPC, automated browsers, language), field leak alerts after a decline, public daily chain anchors, and a hashed Evidence Pack.
2. **DPDP-native and global.** Notices in all 22 Eighth Schedule languages with human review status, itemised data per purpose, rights, grievance and Board links, India residency, and Consent Manager interoperability on the roadmap.
3. **Fast and fair by default.** A build-enforced 10 KB budget, equal-weight buttons, a fairness check that blocks publishing dark patterns, and 180-day re-ask suppression after a reject.

## What we built from this (October 2026)

| Gap | Feature | Where |
|---|---|---|
| Banners that don't block | Field leak detection in the SDK, leak reports, "add as tracker" fix | SDK, `/api/v1/leak`, dashboard Leaks |
| Proof for auditors | Signals in receipts (GPC, automated, language), backward-compatible hashing, public daily anchors, Evidence Pack with its own digest | `crypto.ts`, `/api/v1/anchors`, dashboard Evidence |
| DPDP notices | 22-language drafts with review status, language detection, itemised data and retention, rights and Board links, readiness score | SDK, dashboard Languages and DPDP readiness |
| Dark patterns | Fairness check that blocks publishing, re-ask suppression | Banner builder, SDK |
| Withdrawal propagation | Signed webhooks with delivery log and `verifySignature` | `webhooks.ts`, dashboard Webhooks |
| Pricing pain | Per-account pricing, INR with GST, soft caps, one-click cancel, savings calculator | Plans, pricing page, billing |
| Distribution | WordPress plugin; React, Next.js, Vue, Svelte and Angular packages | `integrations/wordpress`, `packages/` |
| Preference UX | "Customise Consent Preferences" centre with accordions, data items and rights | SDK |

## Pricing

| Plan | USD/mo | INR/mo (+GST) | Sites | Pageviews |
|---|---|---|---|---|
| Free | 0 | 0 | 1 | 10k |
| Starter | 9 | 499 | 2 | 50k |
| Growth | 29 | 1,999 | 10 | 250k |
| Business | 99 | 6,999 | Unlimited | 2M |
| Enterprise | Custom | Custom | Custom | Custom |

Policies: priced per account, pageviews pooled, soft caps with 30-day grace, never auto-upgrade or charge overage, one-click cancel, export the log any time. INR price points are a recommendation; validate with around 10 customer interviews.

## Still open

- IAB TCF 2.3 certification (needed only if we target EU publishers).
- Consent Manager interoperability, once the Board publishes standards.
- Verifiable parental consent under Rule 10 (DigiLocker).
- Shopify app.
- Human review of the 22 language drafts by native speakers before customers rely on them.
- Re-verify third-party script sizes and enforcement figures before using them in paid campaigns.
