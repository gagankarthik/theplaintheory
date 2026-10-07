/**
 * Install instructions for every way a customer can add the SDK, built from one place so the
 * dashboard (real key and URLs) and the public docs (placeholders) never disagree.
 *
 * Every method is the same <script> tag placed first in <head>; only where you paste it differs.
 * The @plaintheory/* framework packages aren't on npm yet, so no method depends on them.
 */

/** The CloudFront distribution that serves the SDK and published configs. */
export const CDN_ORIGIN = (process.env.NEXT_PUBLIC_CDN_URL || "https://d34dtur9cre43o.cloudfront.net").replace(/\/$/, "");
export const SDK_URL = `${CDN_ORIGIN}/sdk/v1/plain-consent.js`;

export interface InstallTarget {
  siteKey: string;
  /** script src */
  src: string;
  /** consent API base, e.g. https://www.theplaintheory.in/api/v1 */
  api?: string;
  /** published settings JSON on the CDN */
  configUrl?: string;
}

export type MethodGroup = "code" | "platform";

export interface InstallMethod {
  id: string;
  label: string;
  group: MethodGroup;
  /** numbered steps in plain words, shown above the code */
  steps: string[];
  /** where the code goes, e.g. "app/layout.tsx" */
  file: string;
  code: string;
}

/** Attributes as [name, value] pairs, so each syntax (HTML, JSX, objects) can render them. */
function attrs(t: InstallTarget): [string, string][] {
  return [["src", t.src], ["data-site", t.siteKey], ...(t.api ? [["data-api", t.api] as [string, string]] : []), ...(t.configUrl ? [["data-config-url", t.configUrl] as [string, string]] : [])];
}

const html = (t: InstallTarget, indent = "") =>
  [`${indent}<script`, ...attrs(t).map(([k, v]) => `${indent}  ${k}="${v}"`), `${indent}></script>`].join("\n");

export function installMethods(t: InstallTarget): InstallMethod[] {
  const a = attrs(t);
  const tag = html(t);
  return [
    {
      id: "html",
      label: "HTML",
      group: "code",
      file: "Every page, in <head>",
      steps: ["Paste this as the first tag inside <head> on every page, above Google Tag Manager, analytics and ad scripts."],
      code: `<head>\n${html(t, "  ")}\n  <!-- everything else after -->\n</head>`,
    },
    {
      id: "nextjs",
      label: "Next.js",
      group: "code",
      file: "app/layout.tsx",
      steps: ["Add the Script to your root layout.", 'strategy="beforeInteractive" puts it in the server HTML <head>, so it runs before any other script.'],
      code: `import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script
${a.map(([k, v]) => `          ${k}="${v}"`).join("\n")}
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}`,
    },
    {
      id: "react",
      label: "React (Vite, CRA)",
      group: "code",
      file: "index.html",
      steps: ["Open the index.html at the root of your project (public/index.html in Create React App).", "Paste the tag first in <head>."],
      code: `<!doctype html>\n<html lang="en">\n  <head>\n${html(t, "    ")}\n    <meta charset="UTF-8" />\n    <!-- ... -->\n  </head>`,
    },
    {
      id: "vue",
      label: "Vue / Nuxt",
      group: "code",
      file: "nuxt.config.ts (or index.html for Vue + Vite)",
      steps: ["Nuxt: add the script to app.head with tagPosition: \"head\".", "Plain Vue + Vite: paste the HTML tag first in index.html instead."],
      code: `export default defineNuxtConfig({
  app: {
    head: {
      script: [
        {
${a.map(([k, v]) => `          ${k.includes("-") ? `"${k}"` : k}: "${v}",`).join("\n")}
          tagPosition: "head",
        },
      ],
    },
  },
});`,
    },
    {
      id: "svelte",
      label: "SvelteKit",
      group: "code",
      file: "src/app.html",
      steps: ["Paste the tag above %sveltekit.head% in src/app.html."],
      code: `<head>\n${html(t, "  ")}\n  %sveltekit.head%\n</head>`,
    },
    {
      id: "angular",
      label: "Angular",
      group: "code",
      file: "src/index.html",
      steps: ["Paste the tag first in <head> of src/index.html."],
      code: `<head>\n${html(t, "  ")}\n  <base href="/" />\n</head>`,
    },
    {
      id: "gtm",
      label: "Google Tag Manager",
      group: "platform",
      file: "Tags → New → Custom HTML",
      steps: [
        "In Tag Manager, create a Custom HTML tag and paste the code.",
        'Set the trigger to "Consent Initialization - All Pages" so it fires before every other tag.',
        "Submit and publish the container. A direct <head> tag is still the most reliable: GTM itself loads after the page starts.",
      ],
      code: tag,
    },
    {
      id: "wordpress",
      label: "WordPress",
      group: "platform",
      file: "Appearance → Theme File Editor → header.php",
      steps: [
        "Paste the tag right after <head> in your theme's header.php (use a child theme so updates don't remove it).",
        "Or use a header-code plugin such as WPCode: add a snippet, choose \"Site wide header\" and the highest priority.",
      ],
      code: tag,
    },
    {
      id: "shopify",
      label: "Shopify",
      group: "platform",
      file: "Online Store → Themes → Edit code → layout/theme.liquid",
      steps: ["Open layout/theme.liquid.", "Paste the tag directly after the opening <head>, above {{ content_for_header }}.", "Save."],
      code: `<head>\n${html(t, "  ")}\n  {{ content_for_header }}`,
    },
    {
      id: "webflow",
      label: "Webflow",
      group: "platform",
      file: "Site settings → Custom code → Head code",
      steps: ["Paste the tag at the top of Head code.", "Save, then publish your site."],
      code: tag,
    },
    {
      id: "wix",
      label: "Wix / Squarespace",
      group: "platform",
      file: "Wix: Settings → Custom code · Squarespace: Settings → Code injection",
      steps: ["Wix: add custom code, place it in Head, load on all pages, and set it to load first.", "Squarespace: paste it into the Header field of Code injection.", "Both need a paid plan that allows custom code."],
      code: tag,
    },
  ];
}
