# Dashboard kit

The dashboard and staff console wear the website's brand: Switzer, soot / chalk / white, lime as the
"on" colour, pill buttons, 18px panels, JetBrains Mono for data. Tokens live in `src/app/globals.css`
(light in `@theme`, dark in `:root[data-theme="dark"]`); the shell sets `.pt-app`, which re-scales
the larger type sizes for the app. Read this before building a page.

## Rules

- Semantic tokens only, never raw hues. One primary button per view. Semibold (600) is the heaviest
  weight; use 400 / 500 / 600 only.
- Spacing on the 4px grid (8px steps for layout). Motion 150–300ms, ease-out, no loops except the
  loading shimmer; everything is skipped under reduced motion.
- Lime means "on" (current page, selected row, switch on, chosen segment) and always comes with a
  second cue: weight, a marker bar, a tick, `aria-current` / `aria-selected` / `aria-pressed`.
- Jade, amber and rose are for consent states and errors only, and always with words or a glyph.
- Success is a toast (`useToast()`); errors are inline next to what failed (`FormMessage`, field
  `error`, `Alert tone="danger"`). Destructive actions go through `ConfirmDialog`.
- The customer account is an "Organization", never a "workspace".
- Selects are always `Select` / `SelectField`, never a native `<select>`.
- Primary controls are at least 40px tall; small buttons grow to 44px on phones automatically.

## Tokens (Tailwind utilities: `bg-*`, `text-*`, `border-*`, `ring-*`)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` (= `paper`) | chalk #f2f2ef | soot #0f0f0f | page background |
| `surface` | #ffffff | soot-2 #1a1a1a | cards, bars, menus |
| `raised` | #f7f7f5 | #222222 | hover rows, table head, card footer |
| `ink` / `ink-2` / `ink-3` | #0f0f0f / #2b2b2b / #555555 | #f2f2ef / #cfcfca / #a3a39e | text, secondary text, muted text |
| `line` / `line-strong` | #e4e4df / #cfcfc9 | #2b2b2b / #3a3a3a | hairlines (decorative) |
| `boundary` (= `line-input`) | #83837e | #76766f | input, checkbox, outline-button edges (3:1) |
| `interactive` / `on-interactive` | soot / white | lime / soot | primary action fill and its text |
| `interactive-hover` | #2b2b2b | lime-deep | primary hover |
| `selected` / `on-selected` | lime / soot | #29321a / chalk | the "on" wash and its text |
| `marker` | soot | lime | current-item bar, active tab underline |
| `focus` | soot | lime | 2px focus ring, 2px offset (global `:focus-visible`) |
| `success`, `warning`, `destructive` (+ `-wash`) | jade / amber / rose | lifted for dark | states and errors |
| `destructive-solid` / `on-destructive-solid` | rose / white | light rose / soot | danger button |
| `brand`, `brand-wash`, `brand-solid`, `on-brand-solid` | older aliases (soot / lime / soot / white) | lime-based | kept for existing pages |

Radii: `rounded-sm` 6 (chips, checkboxes), `rounded-md` 12 (inputs, selects, alerts, toasts),
`rounded-lg` 18 (cards, panels, tables), `rounded-xl` 22 (dialogs, sheets), `rounded-full` buttons.

Type (inside `.pt-app`): `text-xs` 12 · `text-sm` 14 (body) · `text-base` 16 (card titles) ·
`text-lg` 18 (dialog titles) · `text-xl` 22 (page titles, phones) · `text-2xl` 28 (page titles,
KPI figures). Figures use `tabular-nums`; codes, keys and hashes use `font-mono`.

## Components

- `Button`, `ButtonLink`, `ButtonAnchor`, `buttonClass(variant, size)`: variants `primary`,
  `secondary` (outline; `ghost` is the same style, kept for existing callers), `quiet` (borderless),
  `danger`, `danger-quiet`, `link`; sizes `sm` 32 · `md` 40 · `lg` 48; `loading` + `loadingLabel`.
  `SubmitButton` follows the form's pending state.
- Fields: `TextField`, `TextAreaField`, `SelectField`, `DateField`, `ChipInput`, `Checkbox`,
  `Switch`. Pass `error` to get the rose edge, an icon and `aria-invalid`/`aria-describedby`.
- `Card` + `CardHeader` / `CardBody` / `CardFooter` (`tone="danger"` for irreversible actions);
  `SettingsSection` + `SettingsRow`; `ResourceList`; `DescriptionList`; `EmptyState`.
- Numbers: `StatStrip` (a page's 2–4 headline numbers, optional `href` per stat), `KpiTile`
  (with `onSelect` it is a toggle that drives a chart: lime wash + marker + `aria-pressed`).
- `DataTable`: sortable columns (`sortValue`), `numeric: true` (or `align: "right"`) for
  right-aligned tabular figures, `isSelected(row)` for selected rows, `maxHeight` to scroll inside
  the card with a sticky header; stacks into label/value rows below 640px.
- `Badge` (tones `success` `warning` `danger` `neutral` `info` `brand`, plus the consent aliases
  `released` `held` `declined`; each has a shape glyph as well as colour), `StatusDot` (`label` is
  required; shapes differ per tone).
- `Tabs` + `TabPanel` (marker underline, semibold active label), `Segmented` (lime pill).
- `Dialog`, `Sheet`, `ConfirmDialog` (native `<dialog>`: focus trap, Escape, scrim, focus return).
- `useToast()`, `FormMessage`, `Alert`, `Progress`, `Skeleton*`, `Pagination`, `FilterBar`,
  `CopyButton`, `DateText`.

## Shell (`src/components/app/shell`)

- `PageHeader` renders breadcrumbs on every page from the path (Organization / site / section).
  Pass `crumbs` only for pages below a section; its last item names the leaf.
- `Dropdown` is the menu primitive: portalled, clamped to the viewport, flips up, a bottom sheet on
  phones, optional `search`. Use `menuItemClass`, `MenuSeparator`, `MenuLabel` for its rows.
- `nav.tsx`: `NavRail` (md and up, collapsible), `NavDrawer` (phones, modal), `NavGroups`.
