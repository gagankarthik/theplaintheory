import { formatPrice } from "@/lib/plans";
import { getLivePlans } from "@/lib/stripe-catalog";
import { MARKETING_ROUTES } from "@/lib/marketing-routes";
import { sdkSizeKb } from "@/lib/sdk-size";
import { absoluteUrl, site } from "@/lib/site";

/** Short descriptions for each public page, so language models can pick the right one to cite. */
const ABOUT: Record<string, [title: string, about: string]> = {
  "/": ["Home", "What Plain Theory is, the laws it covers and how the consent log works"],
  "/pricing": ["Pricing", "Plans, limits and prices in USD, EUR, GBP and INR"],
  "/contact": ["Contact us", "Every way to reach Plain Theory: support, sales, Help Center, partners and enterprise, with emails and response times"],
  "/contact-sales": ["Talk to sales", "Enterprise rollouts, EU or US data residency by arrangement, and SSO on request"],
  "/contact/support": ["Support ticket", "Raise a ticket with our support engineers; replies within one business day"],
  "/contact/partners": ["Partner support", "Account, campaign, program and payout queries for agency, affiliate, technology and strategic partners"],
  "/contact/enterprise": ["Enterprise and compliance requests", "DPA requests, data residency, audit evidence, custom terms, security questionnaires and procurement"],
  "/docs": ["Documentation", "One script tag that works with HTML, Next.js, React, Vue, Svelte, Angular, WordPress and more, plus the JavaScript and REST APIs"],
  "/compliance/gdpr": ["GDPR guide", "GDPR and ePrivacy cookie consent requirements"],
  "/compliance/ccpa": ["CCPA/CPRA guide", "Opt-out rights and Global Privacy Control in California"],
  "/compliance/dpdpa": ["DPDPA guide", "India's DPDP Act 2023 and DPDP Rules 2025 readiness"],
  "/security": ["Security", "Encryption, residency, access control and SOC 2 preparation"],
  "/brand": ["Brand", "Logo, colours and typography"],
  "/legal/privacy": ["Privacy notice", "How we handle personal data"],
  "/legal/terms": ["Terms of service", "The agreement for using Plain Theory"],
  "/legal/cookies": ["Cookie policy", "Cookies and storage our site and app use"],
};

/**
 * /llms.txt (llmstxt.org): a plain Markdown summary of the site for AI assistants and crawlers.
 * Built from the same route list as the sitemap and from live plan data, so it can't drift.
 */
/** Built once at deploy: the content only changes when routes or prices do. */
export const dynamic = "force-static";
/** Prices are live from Stripe; regenerate every five minutes. */
export const revalidate = 300;

export async function GET() {
  const prices = (await getLivePlans()).filter((p) => p.priceMonthly !== null)
    .map((p) => p.priceMonthly === 0 ? `${p.name} (no charge)` : `${p.name} ${formatPrice(p.priceMonthly!, "usd")}/month`)
    .join(", ");
  const pages = MARKETING_ROUTES.map((r) => {
    const [title, about] = ABOUT[r.path] ?? [r.path, ""];
    return `- [${title}](${absoluteUrl(r.path)})${about ? `: ${about}` : ""}`;
  });

  const body = `# ${site.name}

> ${site.description}

Key facts:
- Consent script: ${sdkSizeKb()} KB gzipped, blocks known trackers until the visitor chooses, honours Global Privacy Control and sends Google Consent Mode v2 signals.
- Laws covered: GDPR and UK GDPR, CCPA/CPRA, and India's DPDP Act 2023 with the DPDP Rules 2025 (notices in all 22 Eighth Schedule languages).
- Proof: every decision is a receipt chained to the previous one by a SHA-256 hash; verification runs in one click, and anyone with the export can verify the chain; an Evidence Pack exports the verified chain.
- Data residency: stored in India (AWS Mumbai, ap-south-1). EU or US residency on Enterprise, by arrangement.
- Pricing (monthly, excluding tax): ${prices}. Enterprise is custom. Priced per account, not per domain.
- Plain Theory provides software, not legal advice.

## Pages

${pages.join("\n")}

## Contact

- Contact options: ${absoluteUrl("/contact")}
- Support and general: ${site.email}
- Sales: sales@theplaintheory.in
- Privacy: ${site.privacyEmail}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
