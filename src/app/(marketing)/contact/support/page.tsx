import { connection } from "next/server";
import { IconLifebuoy } from "@/components/icons";
import { RequestLayout } from "@/components/marketing/contact/request-layout";
import { SupportForm } from "@/components/marketing/contact/support-form";
import { issueFormToken } from "@/lib/form-guard";
import { RESPONSE_TIMES } from "@/lib/lead-options";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Raise a support ticket",
  description: "Banner not showing, a tracker not blocked, or a problem with the consent log or billing? Raise a ticket with our support engineers. Replies within one business day.",
  path: "/contact/support",
  socialTitle: "Raise a ticket with our support engineers",
});

export default async function SupportPage() {
  // Render per request: the form carries a signed render timestamp for the spam time trap.
  await connection();
  const formToken = issueFormToken("contact-support");
  return (
    <RequestLayout
      title="Raise a ticket"
      lead="Something not working as expected? Tell us what happened and our support engineers will look into it."
      crumb={{ name: "Support", href: "/contact/support" }}
      icon={IconLifebuoy}
      responseTime={RESPONSE_TIMES.support}
      next={[
        "Your ticket gets a reference number straight away.",
        "An engineer checks your site's setup before replying, so include the domain if you can.",
        "Mark production outages as Urgent: they are handled first.",
      ]}
      email={{ address: site.email, note: "Put your site domain in the subject." }}
      links={[
        { href: "/docs", label: "Browse the Help Center" },
        { href: "/security", label: "Security and data handling" },
      ]}
    >
      <SupportForm formToken={formToken} />
    </RequestLayout>
  );
}
