"use client";

import { useEffect, useRef } from "react";

/**
 * Hero background: a field of small consent toggles. Sparse and "off" behind the copy, denser and
 * "on" toward the product on the right. One left-to-right sweep on load, then toggles near the
 * pointer switch on and ease back. Canvas-drawn, animates only while something is changing, pauses
 * off-screen, and is static for reduced-motion and touch users.
 */

const GAP_X = 36;
const GAP_Y = 30;
const PILL_W = 14;
const PILL_H = 8;
const RADIUS = 150; // pointer influence, CSS px
const SWEEP_MS = 1400;

const OFF_TRACK = "#d0d4de"; // line-strong
const OFF_KNOB = "#d0d4de"; // line-strong
const ON_TRACK = "#2e2bd6"; // brand
const ON_KNOB = "#ffffff"; // surface

interface Cell {
  x: number;
  y: number;
  /** resting state: 1 = on */
  base: number;
  /** current animated state 0..1 */
  v: number;
  /** pointer-driven target boost 0..1 */
  boost: number;
  /** opacity from the layout mask */
  alpha: number;
}

/** Deterministic pseudo-random per cell so the pattern is stable across renders. */
function hash(i: number, j: number) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * @param clearOf CSS selector (inside the same host) whose box the field leaves empty, with a soft
 *   edge, so artwork sits on clean background with toggles only around it.
 */
export function ToggleField({ className = "", clearOf }: { className?: string; clearOf?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    let cells: Cell[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let visible = true;
    let start = performance.now();
    const pointer = { x: -9999, y: -9999, active: false };

    const layout = () => {
      const rect = host.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const clear = clearOf ? host.querySelector(clearOf)?.getBoundingClientRect() : undefined;
      const hole = clear && clear.width > 0 ? { l: clear.left - rect.left, t: clear.top - rect.top, r: clear.right - rect.left, b: clear.bottom - rect.top } : null;
      /** 0 inside the cleared box, rising to 1 over the next 40px. */
      const holeFade = (x: number, y: number) => {
        if (!hole) return 1;
        const dx = Math.max(hole.l - x, 0, x - hole.r);
        const dy = Math.max(hole.t - y, 0, y - hole.b);
        return smooth(4, 44, Math.hypot(dx, dy));
      };

      const cols = Math.ceil(width / GAP_X) + 1;
      const rows = Math.ceil(height / GAP_Y) + 1;
      // Offset alternate rows by half a column: reads as woven, not a spreadsheet.
      cells = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * GAP_X + (j % 2 ? GAP_X / 2 : 0) + 6;
          const y = j * GAP_Y + 10;
          const nx = x / width;
          const ny = y / height;
          // Density of "on" rises toward the product on the right.
          // quiet behind the copy on the left, denser toward the artwork on the right
          const edge = nx;
          const pOn = 0.3 * smooth(0.55, 1, edge);
          const base = hash(i, j) < pOn ? 1 : 0;
          // Quiet behind the copy (left), fully present on the right; fade top and bottom edges.
          const horizontal = 0.12 + 0.6 * smooth(0.4, 0.85, edge);
          const vertical = smooth(0, 0.16, ny) * smooth(1, 0.78, ny);
          cells.push({ x, y, base, v: reduce ? base : 0, boost: 0, alpha: horizontal * vertical * holeFade(x, y) });
        }
      }
    };

    const drawCell = (c: Cell) => {
      const t = Math.min(1, Math.max(0, c.v));
      if (c.alpha < 0.02) return;
      const x = c.x - PILL_W / 2;
      const y = c.y - PILL_H / 2;
      const r = PILL_H / 2;
      ctx.globalAlpha = c.alpha * (0.55 + 0.45 * t);
      // track
      ctx.beginPath();
      ctx.roundRect(x, y, PILL_W, PILL_H, r);
      if (t > 0.5) {
        ctx.fillStyle = ON_TRACK;
        ctx.globalAlpha *= 0.35 + 0.65 * (t - 0.5) * 2;
        ctx.fill();
      } else {
        ctx.strokeStyle = OFF_TRACK;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // knob slides from left (off) to right (on)
      ctx.globalAlpha = c.alpha * (0.6 + 0.4 * t);
      ctx.beginPath();
      ctx.arc(x + r + (PILL_W - PILL_H) * t, c.y, r - 1.6, 0, Math.PI * 2);
      ctx.fillStyle = t > 0.5 ? ON_KNOB : OFF_KNOB;
      ctx.fill();
    };

    const frame = (now: number) => {
      raf = 0;
      ctx.clearRect(0, 0, width, height);
      let moving = false;
      const sweep = reduce ? 1 : (now - start) / SWEEP_MS;

      for (const c of cells) {
        // the load sweep reveals resting "on" states from left to right
        const revealed = sweep * 1.25 > c.x / width ? c.base : 0;
        if (finePointer && pointer.active && !reduce) {
          const d = Math.hypot(c.x - pointer.x, c.y - pointer.y);
          c.boost = Math.max(c.boost * 0.94, d < RADIUS ? 1 - d / RADIUS : 0);
        } else {
          c.boost *= 0.94;
        }
        const target = Math.max(revealed, c.boost > 0.35 ? 1 : 0);
        const next = c.v + (target - c.v) * 0.16;
        if (Math.abs(next - c.v) > 0.002 || c.boost > 0.01) moving = true;
        c.v = next;
        drawCell(c);
      }
      ctx.globalAlpha = 1;
      if ((moving || sweep < 1.3) && visible) raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };

    layout();
    kick();

    const ro = new ResizeObserver(() => {
      layout();
      start = performance.now() - SWEEP_MS * 2; // no second sweep on resize
      kick();
    });
    ro.observe(host);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(host);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = host.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      kick();
    };
    const onLeave = () => {
      pointer.active = false;
      kick();
    };
    if (finePointer && !reduce) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [clearOf]);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} />;
}
