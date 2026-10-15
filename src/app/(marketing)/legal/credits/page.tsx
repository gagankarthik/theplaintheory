import { PageHero } from "@/components/marketing/page-hero";
import { PICTURES } from "@/components/marketing/picture-credits";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Image credits",
  description: "Sources and licences for the archival pictures used on the Plain Theory website.",
  path: "/legal/credits",
});

/** Credits for the archival pictures on the website, as their licences ask. */
export default function CreditsPage() {
  return (
    <>
      <PageHero
        tone="ink"
        title="Image credits"
        lead="The archival pictures on this website come from open collections. They do not show our product, customers or team."
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Image credits", href: "/legal/credits" },
        ]}
      />
      <section aria-label="Pictures and their sources" className="on-light bg-white px-5 py-12 sm:px-8 md:py-16">
        <ul className="mx-auto grid max-w-[1440px] gap-2 sm:grid-cols-2">
          {Object.values(PICTURES).map((p) => (
            <li key={p.src} className="rounded-[18px] bg-chalk p-6">
              <p className="text-[1.125rem] font-semibold tracking-[-0.02em]">{p.credit}</p>
              <p className="mt-2 text-[1rem] text-mute-ink">{p.alt}</p>
              <a href={p.page} className="mk-link mt-3 inline-flex min-h-11 items-center text-[1rem] font-medium" rel="noopener">
                Source and licence
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
