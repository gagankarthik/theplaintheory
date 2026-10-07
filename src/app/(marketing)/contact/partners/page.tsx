import { connection } from "next/server";
import { IconPartners } from "@/components/icons";
import { PartnerForm } from "@/components/marketing/contact/partner-form";
import { RequestLayout } from "@/components/marketing/contact/request-layout";
import { issueFormToken } from "@/lib/form-guard";
import { RESPONSE_TIMES } from "@/lib/lead-options";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Partner support",
  description: "Help with account, campaign, payout and program queries for agency, affiliate, technology and strategic partners of Plain Theory.",
  path: "/contact/partners",
  socialTitle: "Partner support",
});

export default async function PartnersPage() {
  await connection();
  const formToken = issueFormToken("contact-partners");
  return (
    <RequestLayout
      title="Partner support"
      lead="Help with account, campaign and program queries for agency, affiliate, technology and strategic partners."
      crumb={{ name: "Partners", href: "/contact/partners" }}
      icon={IconPartners}
      responseTime={RESPONSE_TIMES.partner}
      next={[
        "Your request gets a reference number straight away.",
        "It goes to the person who manages your partnership type.",
        "Not a partner yet? Choose the type you want to join as, and Program as the query.",
      ]}
      email={{ address: site.email, note: "Put “Partner” and your company name in the subject." }}
      links={[
        { href: "/pricing", label: "Plans and pricing" },
        { href: "/docs", label: "Integration docs" },
      ]}
    >
      <PartnerForm formToken={formToken} />
    </RequestLayout>
  );
}
