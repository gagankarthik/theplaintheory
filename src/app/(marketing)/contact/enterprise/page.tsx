import { connection } from "next/server";
import { IconBuilding } from "@/components/icons";
import { EnterpriseForm } from "@/components/marketing/contact/enterprise-form";
import { RequestLayout } from "@/components/marketing/contact/request-layout";
import { issueFormToken } from "@/lib/form-guard";
import { RESPONSE_TIMES } from "@/lib/lead-options";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Enterprise and compliance requests",
  description: "Request a DPA, data residency details, audit evidence, custom terms or help with a security questionnaire and vendor onboarding.",
  path: "/contact/enterprise",
  socialTitle: "Enterprise and compliance requests",
});

export default async function EnterprisePage() {
  await connection();
  const formToken = issueFormToken("contact-enterprise");
  return (
    <RequestLayout
      title="Enterprise and compliance"
      lead="DPA requests, data residency, audit trails, custom terms and procurement. Tell us what your legal, security or procurement team needs."
      crumb={{ name: "Enterprise", href: "/contact/enterprise" }}
      icon={IconBuilding}
      responseTime={RESPONSE_TIMES.enterprise}
      next={[
        "Your request gets a reference number straight away.",
        "Standard documents, such as our DPA and sub-processor list, are usually sent with the first reply.",
        "Custom terms and questionnaires are scoped with you first, so we can give a realistic date.",
      ]}
      email={{ address: site.privacyEmail, note: "For data protection questions. For contracts, write to " + site.legalEmail + "." }}
      links={[
        { href: "/security", label: "Security overview" },
        { href: "/contact-sales", label: "Pricing for many sites: talk to sales" },
      ]}
    >
      <EnterpriseForm formToken={formToken} />
    </RequestLayout>
  );
}
