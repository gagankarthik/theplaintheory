import { SectionNav } from "@/components/app/shell/section-nav";

/** Trackers & catalog: what the scanner finds, and the catalog that decides what waits for consent. */
export default async function Layout({ children, params }: LayoutProps<"/app/sites/[propertyId]">) {
  const { propertyId } = await params;
  const base = `/app/sites/${propertyId}`;
  return (
    <>
      <SectionNav label="Trackers and catalog" tabs={[{ href: `${base}/trackers`, label: "Catalog" }, { href: `${base}/scanner`, label: "Scanner" }]} />
      {children}
    </>
  );
}
