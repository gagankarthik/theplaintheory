"use client";

const CODE = `(function(){try{var p=localStorage.getItem("pt-theme");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})();`;

/**
 * Runs before the dashboard paints so there is no light flash for dark-theme users. Rendered by the
 * dashboard, staff console and onboarding layouts. Keep the storage key in sync with theme.tsx.
 *
 * Only the server-rendered HTML carries a runnable script. React never runs scripts it creates on the
 * client (a client-side navigation into these layouts), and warns when asked to, so on the client the
 * tag is an inert data block; ThemeScope (theme.tsx) applies the theme in a layout effect there instead. The
 * type differs between the two renders on purpose, hence suppressHydrationWarning.
 */
export function ThemeScript() {
  const server = typeof window === "undefined";
  return <script type={server ? undefined : "application/json"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CODE }} />;
}
