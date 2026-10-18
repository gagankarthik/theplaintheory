import { SectionNav } from "@/components/app/shell/section-nav";

/** Consent vault: every receipt, and the evidence pack built from them. */
export default async function Layout({ children, params }: LayoutProps<"/app/sites/[propertyId]">) {
  const { propertyId } = await params;
  const base = `/app/sites/${propertyId}`;
  return (
    <>
      <SectionNav label="Consent vault" tabs={[{ href: `${base}/logs`, label: "Consent log" }, { href: `${base}/evidence`, label: "Evidence pack" }]} />
      {children}
    </>
  );
}
