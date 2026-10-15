/**
 * Runs before the dashboard paints so there is no light flash for dark-theme users. Server component
 * (an inline script in the streamed HTML); rendered by the dashboard, staff console and onboarding
 * layouts. Keep the storage key in sync with theme.tsx.
 */
export function ThemeScript() {
  const code = `(function(){try{var p=localStorage.getItem("pt-theme");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
