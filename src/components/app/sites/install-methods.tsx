"use client";

import { useRef, useState, useTransition } from "react";
import { siAngular, siGoogletagmanager, siHtml5, siNextdotjs, siReact, siShopify, siSvelte, siVuedotjs, siWebflow, siWix, siWordpress, type SimpleIcon } from "simple-icons";
import { runSiteAudit } from "@/app/app/sites/[propertyId]/actions";
import { CodeBlock } from "@/components/app/configure/code-block";
import { LearnMore } from "@/components/app/configure/learn-more";
import { Alert } from "@/components/app/ui/alert";
import { Button } from "@/components/app/ui/button";
import type { InstallMethod } from "@/lib/install-snippets";

const LOGO: Record<string, SimpleIcon> = {
  html: siHtml5,
  nextjs: siNextdotjs,
  react: siReact,
  vue: siVuedotjs,
  svelte: siSvelte,
  angular: siAngular,
  gtm: siGoogletagmanager,
  wordpress: siWordpress,
  shopify: siShopify,
  webflow: siWebflow,
  wix: siWix,
};
const FRAMEWORKS = new Set(["nextjs", "react", "vue", "svelte", "angular"]);

/** The docs section that goes deeper on a method. */
function docsFor(id: string): { anchor: string; topic: string } {
  if (id === "wordpress") return { anchor: "wordpress", topic: "installing on WordPress" };
  if (FRAMEWORKS.has(id)) return { anchor: "frameworks", topic: "installing in your framework" };
  return { anchor: "install", topic: "installing the script" };
}

/**
 * Pick how your site is built from tiles (code first, then builders and tag managers), then copy
 * the exact snippet, with this site's key, for that platform. The tiles are a radio group: arrow
 * keys move between them, as in any single-choice list.
 */
export function InstallMethods({ methods, initial = "html" }: { methods: InstallMethod[]; initial?: string }) {
  const ordered = [...methods.filter((x) => x.group === "code"), ...methods.filter((x) => x.group !== "code")];
  const [id, setId] = useState(initial);
  const m = ordered.find((x) => x.id === id) ?? ordered[0];
  const docs = docsFor(m.id);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + ordered.length) % ordered.length;
    setId(ordered[next].id);
    tiles.current[next]?.focus();
  };

  return (
    <div className="space-y-5">
      <div>
        <p id="platform-label" className="text-sm font-medium text-ink">
          How is your site built?
        </p>
        <div role="radiogroup" aria-labelledby="platform-label" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((x, i) => {
            const on = x.id === m.id;
            const logo = LOGO[x.id];
            return (
              <button
                key={x.id}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setId(x.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-sm transition-colors duration-150 ${
                  on ? "bg-selected font-semibold text-on-selected ring-2 ring-inset ring-marker" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:bg-raised hover:text-ink"
                }`}
              >
                {logo ? (
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d={logo.path} />
                  </svg>
                ) : null}
                <span className="truncate">{x.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div aria-live="polite" className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2 marker:text-ink-3">
          {m.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <CodeBlock id="install-code-label" label={`${m.label} · ${m.file}`} code={m.code} />
        <p className="text-xs text-ink-3">
          <LearnMore anchor={docs.anchor} topic={docs.topic} />
        </p>
      </div>
    </div>
  );
}

type CheckState = { tone: "success" | "warning" | "danger"; title: string; body: string } | null;

/**
 * "Check installation": reads the site's homepage on our servers (the live site check, never an
 * address from the browser) and says whether the Plain Theory script is there.
 */
export function InstallCheck({ propertyId, domain, variant = "primary" }: { propertyId: string; domain: string; variant?: "primary" | "secondary" }) {
  const [state, setState] = useState<CheckState>(null);
  const [pending, start] = useTransition();

  const check = () =>
    start(async () => {
      const r = await runSiteAudit(propertyId);
      if (!r.ok) {
        setState({ tone: "danger", title: "Couldn't check right now", body: r.error });
        return;
      }
      const cmp = r.report.checks.find((c) => c.id === "cmp-present");
      if (cmp?.status === "pass" && cmp.finding.startsWith("Plain Theory")) {
        setState({ tone: "success", title: `Found on ${domain}`, body: "The Plain Theory script is on your homepage. The first banner view or choice confirms it here too." });
      } else if (cmp?.status === "pass") {
        setState({ tone: "warning", title: "Another consent tool is on the page", body: `${cmp.finding} Remove it, then add the Plain Theory script, so visitors see one banner.` });
      } else {
        setState({
          tone: "warning",
          title: `Not found on ${domain} yet`,
          body: `${cmp?.finding ?? "We couldn't find the script."} Check the snippet is in the <head> of every page and the change is deployed.`,
        });
      }
    });

  // the button sits at the end of the status row; the result wraps onto its own full-width line below
  return (
    <>
      <Button variant={variant} onClick={check} loading={pending} loadingLabel="Checking your site" className="shrink-0 self-start">
        {state ? "Check again" : "Check installation"}
      </Button>
      {state ? (
        <Alert tone={state.tone} title={state.title} className="basis-full">
          {state.body}
        </Alert>
      ) : null}
    </>
  );
}
