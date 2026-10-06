/**
 * Banner stylesheet, scoped to the closed shadow root. Theme values arrive as CSS custom properties
 * (--bg, --fg, --ac accent, --act accent text, --r radius, --f font); muted tones and hairlines are
 * mixed from them so any theme, light or dark, stays coherent.
 */
export const CSS = `
:host{all:initial}
*{box-sizing:border-box;margin:0}
.w{position:fixed;z-index:2147483646;font:14px/1.55 var(--f);color:var(--fg);--ln:color-mix(in srgb,var(--fg) 14%,transparent);--mu:color-mix(in srgb,var(--fg) 74%,var(--bg));--tn:color-mix(in srgb,var(--fg) 5%,var(--bg))}
.b{position:relative;background:var(--bg);color:var(--fg);border-radius:var(--r);box-shadow:0 0 0 1px var(--ln),0 1px 2px rgba(0,0,0,.06),0 24px 56px -20px rgba(0,0,0,.32);padding:20px;animation:in .22s cubic-bezier(.2,.8,.2,1)}
.hd{display:flex;align-items:center;gap:10px;margin-bottom:6px}
h2{font-size:15px;font-weight:600;letter-spacing:-.01em;line-height:1.3}
h3{font-size:13.5px;font-weight:600}
.bd,.on{flex:none;font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:var(--tn);box-shadow:inset 0 0 0 1px var(--ln);color:var(--mu)}.bd{margin-inline-start:auto}
p,.mu{color:var(--mu)}
a{color:var(--fg);text-decoration:underline;text-underline-offset:2px;text-decoration-color:var(--ln)}a:hover{text-decoration-color:currentColor}
.bt{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;margin-top:16px}
button,select{font:inherit;color:inherit}
button{font-weight:500;font-size:13.5px;cursor:pointer;border:0;border-radius:calc(var(--r)*.66);min-height:40px;min-width:44px;padding:8px 14px;line-height:1.25;transition:background-color .15s,box-shadow .15s,transform .1s}
button:active{transform:translateY(1px)}
.p{background:var(--ac);color:var(--act)}.p:hover{background:color-mix(in srgb,var(--ac) 88%,#000)}
.s{background:var(--bg);color:var(--fg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--fg) 24%,transparent)}.s:hover{box-shadow:inset 0 0 0 1px var(--fg)}
button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.bar{left:16px;right:16px;bottom:16px}.bar.top{top:16px;bottom:auto}
.bar .b{display:flex;align-items:center;gap:24px;max-width:1200px;margin:0 auto;padding:18px 20px}
.bar .tx{flex:1;min-width:0}.bar .bd{margin-inline-start:0}
.bar .bt{margin:0;flex:none;grid-auto-columns:auto}.bar .bt button{white-space:nowrap}
.toast{bottom:16px;width:min(392px,calc(100vw - 32px))}.toast.bottom-left{left:16px}.toast:not(.bottom-left){right:16px}
.toast .bt,.modal .bt{grid-template-columns:1fr 1fr;grid-auto-flow:row}.toast .c,.modal .c{grid-column:1/-1;order:3}
.modal{inset:0;display:grid;place-items:center;padding:16px;background:rgba(11,16,32,.42);animation:fd .2s}
.modal .b{width:min(500px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:24px}
.pf .b{width:min(600px,100%);padding:0;display:flex;flex-direction:column;overflow:hidden}
.pf .hd{padding:18px 20px;margin:0;border-bottom:1px solid var(--ln)}.pf h2{font-size:16px}
.sc{overflow:auto;padding:16px 20px 4px;flex:1;min-height:0}
.cl{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.cl.op{display:block}
.mo{min-height:28px;padding:2px 0;margin-top:2px;background:none;color:var(--fg);font-size:13px;text-decoration:underline;text-underline-offset:2px}
.ac{list-style:none;padding:0;margin:14px 0 4px;border-radius:calc(var(--r)*.75);box-shadow:inset 0 0 0 1px var(--ln)}
.ac>li+li{border-top:1px solid var(--ln)}
.rw{display:flex;align-items:center;gap:12px;padding:4px 14px 4px 6px}
.ex{flex:1;display:flex;align-items:center;gap:8px;text-align:start;background:none;font-weight:600;padding:8px}
.ex svg{flex:none;transition:transform .18s}.ex[aria-expanded=true] svg{transform:rotate(90deg)}[dir=rtl] .ex svg{transform:scaleX(-1)}[dir=rtl] .ex[aria-expanded=true] svg{transform:rotate(90deg)}
.pn{padding:0 16px 14px 38px;font-size:13px}.pn[hidden]{display:none}
.k{margin-top:10px;font-weight:600;color:var(--fg)}.k span{font-weight:400;color:var(--mu)}
.di{margin:4px 0 0;padding-inline-start:18px;color:var(--mu)}
.sw{position:relative;flex:none;width:40px;min-width:40px;height:24px;min-height:24px;padding:0;border-radius:99px;background:color-mix(in srgb,var(--fg) 22%,var(--bg))}
.sw:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .18s cubic-bezier(.2,.8,.2,1)}
.sw[aria-checked=true]{background:var(--ac)}.sw[aria-checked=true]:after{transform:translateX(16px)}
.rt{margin:12px 0 8px;padding:14px 16px;border-radius:calc(var(--r)*.75);background:var(--tn);font-size:13px}
.rt p{margin-top:4px}.rt ul{margin:8px 0 0;padding-inline-start:18px;display:grid;gap:4px;color:var(--mu)}
.lg{margin-inline-start:auto}.lg select{min-height:32px;max-width:9.5em;border-radius:calc(var(--r)*.5);border:0;padding:4px 8px;background:var(--tn);box-shadow:inset 0 0 0 1px var(--ln);font-size:12.5px}
.pf .bd+.lg{margin-inline-start:0}
.x{min-height:32px;min-width:32px;width:32px;padding:0;display:grid;place-items:center;background:transparent;color:var(--mu)}.x:hover{background:var(--tn);color:var(--fg)}.hd .x{margin-inline-start:auto}.bd~.x,.lg~.x{margin-inline-start:0}
.pf .bt{grid-template-columns:repeat(3,1fr);padding:14px 20px 10px;margin:0;border-top:1px solid var(--ln);background:var(--bg)}
.pw{padding:0 20px 12px;font-size:11px;text-align:center}.pw a{color:var(--mu)}
.fab{left:16px;bottom:16px}.fab.r{left:auto;right:16px}.fab .l{max-width:0;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width .25s,opacity .2s,margin .25s}.fab button:hover .l,.fab button:focus-visible .l{max-width:9em;opacity:1;margin-left:7px}
.fab svg{flex:none;width:18px;height:18px}.fab button{display:flex;align-items:center;justify-content:center;height:44px;min-width:44px;padding:0 13px;font-size:13px;border-radius:99px;background:var(--bg);color:var(--fg);box-shadow:0 0 0 1px var(--ln),0 8px 24px -10px rgba(0,0,0,.35);animation:in .22s}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes in{from{opacity:0;transform:translateY(8px)}}@keyframes fd{from{opacity:0}}
@media (max-width:760px){.bar .b{flex-direction:column;align-items:stretch;gap:0}.bar .bt{margin-top:14px;grid-auto-columns:1fr}}
@media (max-width:480px){.bar,.toast,.bar.top{left:0;right:0;bottom:0;top:auto;width:auto}.modal{padding:0;place-items:end stretch}
.b,.modal .b,.bar .b{border-radius:var(--r) var(--r) 0 0;max-height:85dvh;overflow:auto;width:100%}.pf .b{overflow:hidden}
.bt,.bar .bt,.toast .bt,.modal .bt,.pf .bt{grid-template-columns:1fr;grid-auto-flow:row}.c{order:3}
button{min-height:44px}.ex{min-height:44px}.fab{left:12px;bottom:12px}.fab.r{right:12px}.fab button{height:48px;min-width:48px;padding:0 15px}.pf .hd{flex-wrap:wrap;padding:16px}.pf h2{flex:1 1 60%}.sc{padding:14px 16px 4px}.pf .bt{padding:12px 16px 8px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media (forced-colors:active){button,.sw,.ac{border:1px solid ButtonText}.sw[aria-checked=true]:after{background:Highlight}}
`;

export const FONTS: Record<string, string> = {
  system: "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
  inherit: "inherit",
  serif: "Georgia,'Times New Roman',serif",
  mono: "ui-monospace,Menlo,Consolas,monospace",
};
