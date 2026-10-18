import { SectionNav } from "@/components/app/shell/section-nav";

/** Banner studio: the banner's design, where it shows which notice, and its translations. */
export default async function Layout({ children, params }: LayoutProps<"/app/sites/[propertyId]">) {
  const { propertyId } = await params;
  const base = `/app/sites/${propertyId}`;
  return (
    <>
      <SectionNav label="Banner studio" tabs={[{ href: `${base}/banner`, label: "Design" }, { href: `${base}/regions`, label: "Regions" }, { href: `${base}/languages`, label: "Languages" }]} />
      {children}
    </>
  );
}
