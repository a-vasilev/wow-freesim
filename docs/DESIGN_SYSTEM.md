# FreeSim Design System — "Editorial Noir"

> **Engineer reference.** This document describes the approved visual design implemented in `src/theme/`. It is derived directly from the token files and mockups — every value here matches the code. Do not reference values from memory; check the source files if in doubt.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Brand](#2-brand)
3. [Color](#3-color)
4. [Typography](#4-typography)
5. [Spacing, Radius, Elevation, Motion](#5-spacing-radius-elevation-motion)
6. [Layout & the App Shell](#6-layout--the-app-shell)
7. [Iconography](#7-iconography)
8. [Components](#8-components)
9. [Data Visualization](#9-data-visualization)
10. [Accessibility](#10-accessibility)
11. [Token Discipline & Enforcement](#11-token-discipline--enforcement)
12. [References](#12-references)

---

## 1. Overview

**Editorial Noir** is a dark, warm-charcoal design language built for a tool that needs to feel simultaneously analytical and game-native. The palette is a warm near-black ink ramp (no cold gray — there is a deliberate brown-ink undertone throughout) accented by a single antique-gold family. Typography is type-led and restrained: two weights, tight tracking, tabular figures everywhere numbers appear. WoW-specific UI elements — item tooltips, quality colors — are kept game-authentic regardless of theme, so players stay oriented without learning new conventions.

**Three guiding principles:**

1. **Tokens or nothing.** No raw color, spacing, font, radius, or shadow value ever appears in a component. Every visual property resolves through a semantic design token. A theme change means swapping one token map; zero component files change. This is enforced mechanically, not by convention (see §11).
2. **One theme = one remap.** A theme is exactly one `[data-theme="..."]` block in `semantic.css`. Day one ships `"noir"`. Adding a second theme = adding one more block; no component or Tailwind changes needed.
3. **Quality colors and tooltip palette stay game-true.** WoW item quality colors (`legendary`, `epic`, `rare`, `uncommon`, `common`) and the tooltip text colors (`wow-gold`, `wow-green`, `wow-blue`) are game constants stored as tokens but must never be remapped in a future theme. Players recognize them instantly; consistency with the in-game client is a hard requirement.

**Where it lives in code:**

- Primitive values: `src/theme/tokens.css`
- Semantic mapping (the "noir" theme block): `src/theme/semantic.css`
- Tailwind `@theme` bindings (utilities, type scale, radius, shadow): `src/theme/theme.css`
- Interactive token reference: the `/styleguide` route (the canvas the designer uses)
- Mockup references: `docs/mockups/gear.html`, `docs/mockups/report.html`

---

## 2. Brand

### A1 — The Mark

The mark is named **"A1 Convergence"**: three pairs of concentric antique-gold hairline arcs that collapse toward a single filled dot at the center. The concept evokes Monte Carlo simulations converging to `target_error` — the core metaphor of the product.

Rendered as an inline SVG, 28×28px display size (38×38 viewBox). Stroke weight is 0.9px; each arc pair has decreasing opacity outward (outer: 0.35, mid: 0.60, inner: 0.85) to create a depth illusion. The convergence dot is a filled circle, `r="2.2"`, at center.

```svg
<!-- A1 Convergence mark — exact values from gear.html -->
<svg width="28" height="28" viewBox="0 0 38 38" fill="none" aria-hidden="true">
  <!-- Outermost arc pair -->
  <path d="M 6 19 A 13 13 0 0 1 19 6"  stroke="#c9a24e" stroke-width="0.9" stroke-linecap="round" opacity="0.35"/>
  <path d="M 32 19 A 13 13 0 0 1 19 32" stroke="#c9a24e" stroke-width="0.9" stroke-linecap="round" opacity="0.35"/>
  <!-- Mid arc pair -->
  <path d="M 9.5 19 A 9.5 9.5 0 0 1 19 9.5"   stroke="#c9a24e" stroke-width="0.9" stroke-linecap="round" opacity="0.6"/>
  <path d="M 28.5 19 A 9.5 9.5 0 0 1 19 28.5" stroke="#c9a24e" stroke-width="0.9" stroke-linecap="round" opacity="0.6"/>
  <!-- Inner arc pair -->
  <path d="M 13 19 A 6 6 0 0 1 19 13" stroke="#c9a24e" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
  <path d="M 25 19 A 6 6 0 0 1 19 25" stroke="#c9a24e" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
  <!-- Convergence dot -->
  <circle cx="19" cy="19" r="2.2" fill="#c9a24e"/>
</svg>
```

All arc and dot strokes use `--gold-400` (`#c9a24e`). Never substitute a different color or stroke weight.

### W1 — The Wordmark

The wordmark is named **"W1"**: the text "FreeSim" in Space Grotesk, weight 500–600, at 17px in the sidebar, with letter-spacing `-0.02em` (tight but not compressed). The visual detail: the dot of the lowercase "i" in "Sim" is replaced by a small antique-gold diamond — a 4×4px rotated square (`border-radius: 1px`) positioned absolutely at `top: -2px`, `left: 50%`, `transform: translateX(-50%) rotate(45deg)`, filled with `var(--color-accent)`.

**Do:**
- Render as inline HTML/SVG, never as a raster image
- Keep the diamond-dot detail at all sizes where the "i" is legible
- Use `font-display` (Space Grotesk) only
- Treat the wordmark as a link to the app root (wrapped in `<a>`)

**Do not:**
- Use a boxed monogram, a lettermark, or any logomark that encloses type in a shape
- Place the wordmark on a non-surface-inset background without review
- Apply `color-accent` directly to the full wordmark text (the gold is reserved for the dot only; the type is `color-fg`)

### Accent-on-gold rule

Any text or icon rendered **on top of a gold fill** (e.g. the primary button, the winner badge background) must use `text-accent-fg` (`--ink-950`, `#0e0c0a`). Gold is a light color; white or `fg` text on it fails contrast. This is the only case where `accent-fg` is used.

### Clear space

Maintain at minimum one mark-width of clear space around the mark+wordmark lockup. Do not crowd it with navigation items.

---

## 3. Color

### The two-tier model

**Primitive tokens** (`tokens.css`) define the raw palette — specific hex values organized into named ramps. They are declared in `:root` but are **never referenced in markup or component code**. They exist solely so semantic tokens have something to point at.

**Semantic tokens** (`semantic.css`) are intent-named and are the **only tier components reference** — indirectly, via Tailwind utilities generated from `theme.css`. A semantic token expresses a role (`--c-surface`, `--c-accent`) rather than a value. The token's value changes when a different `[data-theme]` block is active; component code never changes.

### Primitive ramps

#### Ink (warm neutral)

The ink ramp has a faint warm brown undertone throughout — it is not a cold gray. Ink-950 is the app canvas; ink-100 is primary text. The ramp travels from darkest canvas to brightest legible foreground.

| Step | Hex | Role |
|------|-----|------|
| `--ink-950` | `#0e0c0a` | App canvas (bg-surface) |
| `--ink-900` | `#141210` | Raised panels / cards |
| `--ink-850` | `#1a1714` | Sidebar / inset wells / code box |
| `--ink-800` | `#221f1b` | Overlays / chips / row hover |
| `--ink-750` | `#2a2620` | Pressed / selected backgrounds |
| `--ink-700` | `#332f28` | Subtle borders (hairline dividers) |
| `--ink-600` | `#4a4540` | Default control borders |
| `--ink-500` | `#6b655c` | Strong borders / faint text |
| `--ink-400` | `#8f887e` | Subtle text (labels, tertiary) |
| `--ink-300` | `#b3aca0` | Muted text (secondary) |
| `--ink-200` | `#d4cec6` | Near-primary text |
| `--ink-100` | `#ede9e3` | Primary text |
| `--ink-50`  | `#f5f2ec` | Brightest text / danger-fg |

#### Gold (antique; the sole accent family)

Gold is used sparingly and purposefully. It marks interactive affordances (buttons, active state, focus), the DPS accent color, and the brand mark. It is **never used as a general decorative fill**.

| Step | Hex | Role |
|------|-----|------|
| `--gold-600` | `#9e7a1a` | Dim / pressed accent |
| `--gold-500` | `#b8912e` | Mid tone |
| `--gold-400` | `#c9a24e` | **The accent** |
| `--gold-300` | `#d9b96a` | Accent hover / focus / glow |
| `--gold-200` | `#e8d09a` | Lighter hover states |
| `--gold-100` | `#f2e5c0` | Near-white gold |

#### Status

| Token | Hex | Role |
|-------|-----|------|
| `--green-500` | `#3f9c5a` | Success fills |
| `--green-400` | `#5fb977` | Positive delta / delta-positive text |
| `--red-500`   | `#cf5a52` | Danger fills |
| `--red-400`   | `#e07b73` | Negative delta / danger text |
| `--amber-500` | `#cf9a3a` | Warning fills |
| `--amber-400` | `#e0b056` | Warning text |

#### WoW item quality (game constants — never re-themed)

| Token | Hex | In-game tier |
|-------|-----|-------------|
| `--wow-legendary` | `#ff8000` | Legendary (orange) |
| `--wow-epic`      | `#a335ee` | Epic (purple) |
| `--wow-rare`      | `#0070dd` | Rare (blue) |
| `--wow-uncommon`  | `#1eff00` | Uncommon (green) |
| `--wow-common`    | `#9d9d9d` | Common (gray) |

#### WoW tooltip text (game constants — never re-themed)

| Token | Hex | Usage |
|-------|-----|-------|
| `--wow-gold`  | `#ffd100` | "Item Level NNN" + flavor text |
| `--wow-green` | `#1eff00` | Enchants, Use:/Equip: effects |
| `--wow-blue`  | `#aad4f7` | Upgrade track, secondary info |

#### Categorical chart hues

Harmonized for warm-dark canvas. Hue-1 is the accent gold so a single-series chart matches the UI accent. Only used when two or more series need distinction (see §9).

| Token | Hex | Hue |
|-------|-----|-----|
| `--hue-1` | `#c9a24e` | Gold (= accent) |
| `--hue-2` | `#5bb3b0` | Teal |
| `--hue-3` | `#a07cc9` | Violet |
| `--hue-4` | `#cf8a52` | Amber-orange |
| `--hue-5` | `#6f9ed6` | Blue |
| `--hue-6` | `#cf6f72` | Rose |

### Semantic tokens

Every semantic token is prefixed `--c-` in CSS and becomes a Tailwind utility via `theme.css`. The table below lists all tokens in role order.

#### Surfaces

| Token | Maps to | Tailwind utility | Usage |
|-------|---------|-----------------|-------|
| `--c-surface` | `--ink-950` | `bg-surface` | App canvas — the outermost background |
| `--c-surface-raised` | `--ink-900` | `bg-surface-raised` | Cards, panels, report blocks |
| `--c-surface-inset` | `--ink-850` | `bg-surface-inset` | Sidebar, sunken wells, code editor box |
| `--c-surface-overlay` | `--ink-800` | `bg-surface-overlay` | Popovers, menus, chips, row hover bg |

Surfaces layer: canvas → raised → inset → overlay. Never use a lighter surface behind a darker one; doing so breaks the spatial hierarchy.

#### Foreground (text)

| Token | Maps to | Tailwind utility | Usage |
|-------|---------|-----------------|-------|
| `--c-fg` | `--ink-100` | `text-fg` | Primary text — body copy, item names |
| `--c-fg-muted` | `--ink-300` | `text-fg-muted` | Secondary text — subtitles, metadata |
| `--c-fg-subtle` | `--ink-400` | `text-fg-subtle` | Tertiary — labels, slot type labels |
| `--c-fg-faint` | `--ink-500` | `text-fg-faint` | Placeholder, disabled, faint meta |

#### Borders

| Token | Maps to | Tailwind utility | Usage |
|-------|---------|-----------------|-------|
| `--c-border-subtle` | `--ink-700` | `border-border-subtle` / `text-border-subtle` | Default hairline rule between sections, card borders |
| `--c-border` | `--ink-600` | `border-border` | Standard control border |
| `--c-border-strong` | `--ink-500` | `border-border-strong` | Emphasized border, focus outline base |

The default divider between any two adjacent sections is always `border-border-subtle` (1px, `--ink-700`). Do not use a heavier border for routine separation.

#### Accent

| Token | Maps to | Tailwind utility | Usage |
|-------|---------|-----------------|-------|
| `--c-accent` | `--gold-400` | `text-accent` / `bg-accent` / `border-accent` | Active state, primary CTA fill, DPS series, left-marker bar |
| `--c-accent-hover` | `--gold-300` | `text-accent-hover` / `bg-accent-hover` | Button hover / focus fill, focus ring |
| `--c-accent-dim` | `--gold-600` | `text-accent-dim` / `bg-accent-dim` | Pressed accent, bar gradient terminus |
| `--c-accent-fg` | `--ink-950` | `text-accent-fg` | Text/icons ON a gold fill (primary button label) |
| `--c-accent-subtle` | `rgba(201,162,78,0.12)` | `bg-accent-subtle` | Active nav item bg, selected tile bg, hover bg on ghost button |
| `--c-accent-glow` | `rgba(201,162,78,0.2)` | `bg-accent-glow` | Focus glow / CTA box-shadow |

Gold is the **only** accent color in the UI. Do not introduce a second accent color (no blue interactive states, no purple interactive states — those colors are reserved exclusively for WoW quality indicators).

#### Status

| Token | Maps to | Tailwind utility | Usage |
|-------|---------|-----------------|-------|
| `--c-danger` | `--red-500` | `text-danger` / `bg-danger` | Destructive actions, error state |
| `--c-danger-fg` | `--ink-50` | `text-danger-fg` | Text on a danger fill |
| `--c-success` | `--green-500` | `text-success` / `bg-success` | Success fills, engine "ready" indicator |
| `--c-warning` | `--amber-400` | `text-warning` | Warning notices |
| `--c-focus` | `--gold-300` | `outline-focus` / `ring-focus` | Focus ring color (keyboard navigation) |

#### WoW item quality tokens

| Token | Maps to | Tailwind utility |
|-------|---------|-----------------|
| `--c-quality-legendary` | `--wow-legendary` | `text-quality-legendary` / `border-quality-legendary` |
| `--c-quality-epic` | `--wow-epic` | `text-quality-epic` / `border-quality-epic` |
| `--c-quality-rare` | `--wow-rare` | `text-quality-rare` / `border-quality-rare` |
| `--c-quality-uncommon` | `--wow-uncommon` | `text-quality-uncommon` / `border-quality-uncommon` |
| `--c-quality-common` | `--wow-common` | `text-quality-common` / `border-quality-common` |

These tokens map to WoW game constants and must not be remapped in any future theme.

#### WoW tooltip tokens

| Token | Maps to | Tailwind utility | Usage |
|-------|---------|-----------------|-------|
| `--c-tooltip-bg` | `rgba(0,0,0,0.92)` | `bg-tooltip-bg` | Tooltip box background |
| `--c-tooltip-ilvl` | `--wow-gold` | `text-tooltip-ilvl` | "Item Level NNN" + flavor text |
| `--c-tooltip-effect` | `--wow-green` | `text-tooltip-effect` | Enchants, Use:/Equip: proc lines |
| `--c-tooltip-info` | `--wow-blue` | `text-tooltip-info` | Upgrade track, socket gem stat |
| `--c-tooltip-disabled` | `--wow-common` | `text-tooltip-disabled` | Unmet requirements |

#### Data visualization tokens

| Token | Maps to | Tailwind utility | Usage |
|-------|---------|-----------------|-------|
| `--c-dps` | `--gold-400` | `text-dps` / `bg-dps` | DPS series color / headline accent |
| `--c-bar` | `--gold-400` | `bg-bar` | Breakdown bar fill |
| `--c-bar-track` | `--ink-800` | `bg-bar-track` | Bar background track |
| `--c-delta-positive` | `--green-400` | `text-delta-positive` | Top Gear positive DPS gain |
| `--c-delta-negative` | `--red-400` | `text-delta-negative` | Top Gear negative DPS delta |
| `--c-chart-grid` | `--ink-800` | `bg-chart-grid` / `stroke-chart-grid` | Chart gridlines |
| `--c-chart-axis` | `--ink-500` | `text-chart-axis` | Axis tick labels |
| `--c-chart-mean` | `--gold-300` | `stroke-chart-mean` | Mean marker line on histogram |
| `--c-chart-1` | `--hue-1` | `bg-chart-1` | Multi-series color 1 (gold) |
| `--c-chart-2` | `--hue-2` | `bg-chart-2` | Multi-series color 2 (teal) |
| `--c-chart-3` | `--hue-3` | `bg-chart-3` | Multi-series color 3 (violet) |
| `--c-chart-4` | `--hue-4` | `bg-chart-4` | Multi-series color 4 (amber) |
| `--c-chart-5` | `--hue-5` | `bg-chart-5` | Multi-series color 5 (blue) |
| `--c-chart-6` | `--hue-6` | `bg-chart-6` | Multi-series color 6 (rose) |

---

## 4. Typography

### Families

Three families, all self-hosted via `@fontsource-variable` packages imported in `src/main.tsx`.

| Role | Family | Tailwind utility | Notes |
|------|--------|-----------------|-------|
| Display | `'Space Grotesk Variable'` | `font-display` | Headings, character name, big numbers, the wordmark |
| Body | `'Inter Variable'` | `font-sans` | Everything else including the WoW tooltip |
| Mono | System monospace stack | `font-mono` | Raw `.simc` input, `target_error`/iteration readouts |

**Why self-hosted and why it matters:** The app requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers for `SharedArrayBuffer` (multithreaded WASM). These headers block cross-origin resources that do not opt in with CORP/COEP headers — which Google Fonts CDN responses do not. Loading fonts from `fonts.googleapis.com` or `fonts.gstatic.com` at runtime will be blocked. The mockups use Google Fonts CDN as a convenience for static HTML previews only; the deployed app must use self-hosted packages.

Full fallback stacks are declared in `theme.css` so the UI remains legible if the variable fonts have not loaded.

### Type scale

All sizes are defined in `theme.css` via `@theme`. Default Tailwind sizes are stripped (`--text-*: initial`) so only this scale exists.

| Utility | px | Line height | Role |
|---------|-----|-------------|------|
| `text-xs` | 12px | 1rem | Micro labels, badges (minimum for non-body text) |
| `text-sm` | 14px | 1.25rem | **Body / data rows** — the minimum readable body size |
| `text-base` | 16px | 1.5rem | Default body |
| `text-lg` | 18px | 1.75rem | Emphasized body |
| `text-xl` | 20px | 1.75rem | Panel titles |
| `text-2xl` | 24px | 2rem | Section headings |
| `text-3xl` | 30px | 2.25rem | Character name (font-display) |
| `text-4xl` | 36px | 2.5rem | Large headings |
| `text-5xl` | 48px | 1 | Large numbers |
| `text-6xl` | 60px | 1 | Very large numbers |
| `text-7xl` | 72px | 1 | **DPS headline** (font-display) |

### Usage mapping

| Context | Utility |
|---------|---------|
| DPS headline number | `text-7xl font-display tabular-nums` |
| Character name | `text-3xl font-display` (or `text-2xl` at compact sizes) |
| Section heading | `text-2xl font-display` |
| Panel title | `text-xl font-display` |
| Body copy | `text-base font-sans` |
| Data table rows | `text-sm font-sans` |
| Labels, slot type | `text-xs font-sans` (uppercase, tracked) |
| Numeric data cells | add `tabular-nums` to whatever size is in use |
| `.simc` input editor | `font-mono text-sm` |

### Typography rules from design review

- **No body text smaller than 14px (`text-sm`).** The 12px (`text-xs`) size is permitted only for non-body elements: badges, ilvl overlays on icons, column header labels in ALL CAPS.
- **Tabular numerals everywhere numbers appear.** The `body` rule in `theme.css` sets `font-variant-numeric: tabular-nums` globally. Reinforce with the `tabular-nums` utility on any number-dense context (data tables, DPS readouts) to be explicit.
- **No condensed typefaces.** Do not introduce a condensed variant of Space Grotesk or any other family to save horizontal space. Truncate with `text-ellipsis` or rethink the layout instead.
- **No serif typefaces.** The design is sans-serif throughout, including the WoW tooltip (Inter).
- **Letter-spacing convention:** Display text (headings) uses tight tracking (`-0.02em`). Body text is untracked or very slightly tracked (`0.01–0.02em`). ALL-CAPS micro-labels (section eyebrows, panel headers, column headers) use wide tracking (`0.1–0.2em`) to compensate for capital letterform spacing.

---

## 5. Spacing, Radius, Elevation, Motion

### Spacing — 4px grid

All spacing uses Tailwind's built-in 4px-grid multiplier utilities (`p-1` = 4px, `p-2` = 8px, `p-4` = 16px, etc.). Spacing is **not** overridden in `@theme` — it is left on Tailwind's default 4px grid, which provides the full range of on-grid utilities. Arbitrary spacing values (`p-[13px]`, `mt-[7px]`) are blocked by ESLint (see §11).

Key layout measurements extracted from the mockups:

| Element | Value |
|---------|-------|
| Sidebar width | 220px (CSS variable `--sidebar-width`) |
| Page content padding (sides) | 28–40px |
| Page content padding (top) | 24–40px |
| Content header strip height | 52px |
| Gear panel two-pane gap | 20px |
| Card/panel padding | 12–16px sides, 10–14px vertical |
| Candidate row padding | 11px top/bottom, 20px sides |
| Slot tile padding | 5px top/bottom, 7px sides |

### Radius

Default Tailwind radius values are stripped (`--radius-*: initial`). Only this scale exists:

| Token | Value | Tailwind utility | Usage |
|-------|-------|-----------------|-------|
| `--radius-sm` | 2px | `rounded-sm` | Badges, gem chip diamonds, icon corners, slot ilvl overlays |
| `--radius-md` | 4px | `rounded-md` | Buttons, chips, slot tiles, setting chips, checkboxes |
| `--radius-lg` | 6px | `rounded-lg` | Cards, panels, advanced-block containers |
| `--radius-full` | 9999px | `rounded-full` | Engine status chip, pill badges |

The scale is intentionally tight and editorial — no large or bubbly radii. A `rounded-lg` card at 6px is the largest radius in the UI.

### Elevation (shadows)

Default Tailwind shadows are stripped. Only this scale exists:

| Token | Value | Tailwind utility | Usage |
|-------|-------|-----------------|-------|
| `--shadow-sm` | `0 2px 12px rgba(0,0,0,.6)` | `shadow-sm` | Slot tile lift on hover, chip lift |
| `--shadow-md` | `0 4px 24px rgba(0,0,0,.5)` | `shadow-md` | Panel / card elevation |
| `--shadow-lg` | `0 8px 40px rgba(0,0,0,.85), 0 2px 8px rgba(0,0,0,.6)` | `shadow-lg` | WoW tooltip, popover, overlay |

Shadows use only black (no colored shadows) with high opacity because the canvas is dark. The typical shadow on a light-theme app is ~10–15% opacity; on this dark canvas, 50–85% is needed for visible lift.

### Motion

Motion is quiet and functional. The governing rules:

- Transitions are `≤150ms`, `ease` or `ease-in-out` curve. No spring physics, no elaborate entrance animations.
- Color/border transitions: `0.12–0.15s`. The sidebar active background, hover states, and chip borders all use this range.
- The toggle arrow rotation (expand/collapse) uses `0.2s` — the longest transition in the system, justified because it communicates structure change.
- The DPS bar in Top Gear uses `0.3s` — data rendering, not a UI affordance.
- No parallax, no scroll-linked animations, no loading skeletons that animate indefinitely.
- The primary button hover uses `transform: translateY(-1px)` — a subtle lift, `0.1s`. Do not increase the lift distance.

---

## 6. Layout & the App Shell

### B2 — Left Sidebar

The sidebar is the primary navigation shell. It is always visible on desktop (sticky, full-height) and collapses to a horizontal bar on narrow viewports.

| Property | Value |
|----------|-------|
| Width | 220px (`--sidebar-width`; collapses to 196px below 1200px) |
| Background | `bg-surface-inset` (`--ink-850`) |
| Right border | 1px `border-border-subtle` |
| Position | `position: sticky; top: 0; height: 100vh` |

**Internal structure (top to bottom):**

1. **Brand block** — 24px top padding, 20px sides. Contains the A1 mark (28px) + W1 wordmark (17px, Space Grotesk 500). Bottom border `border-border-subtle`.
2. **Nav list** — flex column, `padding: 10–12px 0`. One item per route (Quick Sim, Gear, Droptimizer, History).
3. **Footer** — pinned to bottom via `flex: 1` on the nav list. Contains the engine status chip and the settings button, `padding: 14–16px`. Top border `border-border-subtle`.

**Nav item anatomy:**

```
┌───────────────────────────────────────────────────┐
│ [2px gold left bar]  [16×16 icon]  Label text     │
│  (active only)       (fg-muted→    (fg-muted→     │
│                       accent)       accent, w500)  │
└───────────────────────────────────────────────────┘
```

- Padding: 11px vertical, 20px horizontal
- Icon: 16×16, `currentColor`, inline SVG
- Label: `text-sm` (13px in mockup), `font-sans`
- **Inactive state:** icon and label in `text-fg-muted`; hover = `bg-surface-overlay`, icon/label → `text-fg-muted` (secondary)
- **Active state:** background `bg-accent-subtle`; left marker = 2px `bg-accent` bar, inset 8px from top/bottom, `rounded-sm`; icon and label in `text-accent`, label weight 500
- Transition: `background 0.12s`

**Engine status chip (sidebar footer):**

A small pill (`rounded-full`) in `bg-surface-overlay` with a 5px green dot (hardcoded `#3dd68c` with a matching glow, not a token — this is a live status indicator, not a themed color) and text "8 cores · isolated". Font size ~10.5px. The settings glyph (gear icon, 14×14) sits beside it as a ghost button.

### In-content header strip

The header strip is inside the main content area, not the sidebar. It is sticky at `top: 0` (or `top: 29px` if a caption/debug strip is present), `height: 52px`, `bg-surface-raised`, bottom border `border-border-subtle`.

**Structure:**

```
┌── Left ──────────────────────────────  Right ──────────┐
│  [Section title]  [Sub-tab] [Sub-tab]  [Setting chips] │
└────────────────────────────────────────────────────────┘
```

- Left side: section title (Space Grotesk 600, 13px) + sub-tab row
- Right side (`margin-left: auto`): setting chips (Fight Style, Targets, Length, Precision)

**Sub-tabs (segmented control):** Stretch full height (52px). Active tab has a 2px `border-bottom` in `text-accent`, `position: relative; top: 1px` to sit on the strip bottom border. Text: 11.5px, 500 weight, tracked. Inactive: `text-fg-muted`; active: `text-accent`, weight 600.

**Setting chips:** Pill shape (`rounded-full`), `bg-surface-overlay`, 1px `border-border-subtle`, 11px font, `text-fg-muted`. Each chip contains a key label (uppercase, 9.5px, `text-fg-faint`) and a value (`text-fg-muted`). Chips are separated by 1px vertical dividers (`height: 12px`).

### Page composition — Gear screen

```
┌─ Sidebar (220px) ──┬─ Main content ────────────────────────────┐
│ Brand              │ [In-content header strip — 52px]           │
│ Nav items          │ ─────────────────────────────────────────  │
│ ...                │ [Character context bar]                     │
│                    │   Name · Spec · ilvl         [Equipped DPS] │
│                    │                              [Run Top Gear] │
│                    │ ─────────────────────────────────────────  │
│                    │ [Two-pane grid: 310px left | flex right]   │
│ Footer             │  Equipped panel   │  Top Gear picker panel │
└────────────────────┴───────────────────┴───────────────────────┘
```

The two-pane grid uses `grid-template-columns: 310px 1fr; gap: 20px`. Both panels are `bg-surface-raised`, `border border-border-subtle`, `rounded-lg`.

### Page composition — Report screen

```
┌─ Sidebar (220px) ──┬─ Main content ────────────────────────────┐
│ Brand              │ [In-content header strip — 52px]           │
│ Nav items          │  Quick Sim › Run #42   [chips] [Re-run]   │
│ ...                │ ─────────────────────────────────────────  │
│ Footer             │ [Single column, max-width 1100px, centered] │
│                    │  Character identity block                   │
│                    │  DPS headline + histogram                   │
│                    │  Ability breakdown table                    │
│                    │  Buff uptimes grid                          │
│                    │  [Show advanced ▶] disclosure               │
└────────────────────┴───────────────────────────────────────────┘
```

The report page constrains content to `max-width: 1100px; margin: 0 auto` with `padding: 40px 40px 96px`.

---

## 7. Iconography

### Two distinct icon types

**UI affordance icons** are simple inline-SVG line icons. Stroke weight approximately 1.4px (`stroke-width="1.4"`), `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`, `stroke="currentColor"`. Sizing: 16×16px for sidebar nav, 13×14px for action buttons. These inherit `currentColor` and re-color automatically with the component state (muted → accent on active, etc.).

```svg
<!-- Example: Quick Sim (lightning bolt) -->
<svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
     stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 2L4 9h4l-1 5 5-7H8l1-5z"/>
</svg>
```

**Item and ability icons** are real WoW game artwork — per-record 64×64 (or 56×56) JPEG images, identified by an `icon` name (e.g. `"inv_helmet_25"`) sourced from the engine parse (`inspect()`) and/or Wowhead's tooltip data (the `icon` field), **not** a display bundle of our own. The image itself loads from the Wowhead CDN:

```
https://wow.zamimg.com/images/wow/icons/large/<name>.jpg
```

with an `onerror` fallback to `inv_misc_questionmark.jpg`:

```html
<img
  src="https://wow.zamimg.com/images/wow/icons/large/inv_helmet_25.jpg"
  onerror="this.onerror=null; this.src='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'"
  alt="Crown of the Dawnbreaker icon"
/>
```

**Production approach:** Hot-linking icons from `wow.zamimg.com` (the Wowhead CDN) is the **intended, permanent** approach — not just a dev placeholder. It's the universal practice, the CDN sends `Access-Control-Allow-Origin: *`, and under our `COEP: credentialless` headers (OVERALL_PLAN §1) a plain no-cors `<img>` loads without needing a `crossorigin` attribute. The game icons are Blizzard's artwork surfaced via Wowhead; show a visible "Item & spell data from Wowhead" attribution. We deliberately do **not** build a self-hosted icon/display bundle (OVERALL_PLAN §6). A Cloudflare-Worker icon proxy under our own domain is an optional later hardening, not a launch blocker.

Icon display sizes in components:

| Context | Size |
|---------|------|
| Slot tile (equipped panel) | 34×34px |
| Top Gear candidate row | 40×40px |
| Ability breakdown table | 30×30px |

All item/ability icon elements use `border-radius: var(--radius-sm)` (2px) and carry a 1px quality-colored border.

---

## 8. Components

### 8.1 Sidebar nav item

```
Structure: <a> (or role="menuitem")
  ::before  — 2px accent left bar (active only)
  <svg>     — 16×16 line icon, currentColor
  <span>    — label text, text-sm (13px in mockup)
```

| State | Background | Icon color | Label color | Weight |
|-------|-----------|-----------|------------|--------|
| Default | transparent | `text-fg-muted` | `text-fg-muted` | 400 |
| Hover | `bg-surface-overlay` | `text-fg-muted` (secondary) | `text-fg-muted` (secondary) | 400 |
| Active | `bg-accent-subtle` + left bar | `text-accent` | `text-accent` | 500 |

The left bar: `position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; background: accent; border-radius: 2px`.

### 8.2 In-content header + setting chips

The header strip is documented in §6. Setting chips:

```
Structure: <div class="sim-chip">
  <span> — key (uppercase, text-xs, text-fg-faint)
  <span> — value (text-sm, text-fg-muted)
```

Chip: `bg-surface-overlay`, 1px `border-border-subtle`, `rounded-full`, `padding: 4px 10px`, `tabular-nums`. Between chips: a 1px × 12px vertical line in `border-border-subtle`.

### 8.3 Primary button (gold fill)

```
Structure: <button>
  text — ALL CAPS, text-accent-fg on gold fill
```

| Property | Value |
|----------|-------|
| Background | `bg-accent` |
| Text | `text-accent-fg` (`--ink-950`), ALL CAPS, `font-display`, weight 600, tracking `0.04–0.06em` |
| Radius | `rounded-md` (4px) |
| Padding | `9–10px vertical, 20–24px horizontal` |
| Font size | 11.5–12px |
| Hover | `bg-accent-hover` (`--gold-300`) + `shadow-md` + `translateY(-1px)` |
| Transition | `background 0.15s, box-shadow 0.15s, transform 0.1s` |

Never place `text-fg` (light) text on the gold button fill. Always use `text-accent-fg` (dark ink).

### 8.4 Secondary / ghost button

```
Structure: <button>
  optional <svg> — 13px line icon
  text
```

| Property | Value |
|----------|-------|
| Background | transparent |
| Border | 1px `border-border` or `border-border-subtle` |
| Text | `text-fg-muted`, uppercase, weight 500–600, tracked |
| Radius | `rounded-md` |
| Hover | `border-accent`, `text-accent`, `bg-accent-subtle` |
| Transition | `border-color 0.15s, color 0.15s, background 0.15s` |

Used for Re-run, secondary actions in report, the advanced toggle.

### 8.5 Segmented control / sub-tabs

Each tab is a full-height link (stretching to fill the 52px header). Active state: 2px `border-bottom` in `text-accent`, color `text-accent`, weight 600. Inactive: `text-fg-muted`, weight 500. Hover: `text-fg-muted` (secondary). The active bottom border is positioned `top: 1px` relative so it visually sits on the header strip's bottom border.

### 8.6 Item slot tile

```
Structure: <div class="slot-tile quality-{tier}">
  ::before     — 2px quality left stripe
  .slot-icon   — 34×34px img + .slot-ilvl-badge overlay
  .slot-info
    .slot-label  — uppercase, 9px, text-fg-faint
    .slot-name   — 10.5px, quality-colored or text-fg-muted
```

| State | Background | Border | Box-shadow | z-index |
|-------|-----------|--------|-----------|---------|
| Default | `bg-surface-inset` | `border-border-subtle` | none | auto |
| Hover | `bg-surface-overlay` | `border-border` | `shadow-sm` | 20 |
| Selected | `bg-accent-subtle` | `border-accent` | `0 0 0 1px accent, 0 2px 16px accent-glow-18%` | 5 |
| Empty | `bg-surface-inset` | `border-border-subtle` | none | — |

- **Quality left stripe:** `::before` pseudo-element, 2px wide, inset 5px from top/bottom, `border-radius: 2px`. Color is set via a `--slot-quality-color` CSS variable on the tile itself.
- **ilvl badge:** overlaid at bottom-right of the icon, `background: rgba(10,8,6,0.82)`, 9px, `font-display`, weight 700, `rounded-sm 1px 0 0 0`. For legendary items the badge text inherits the legendary color.
- **Item name color:** matches the item quality (`text-quality-epic`, `text-quality-legendary`, etc.). Empty slot name: `text-fg-faint`, italic.
- **Empty slot:** `pointer-events: none`, `opacity: 0.45` on the entire tile.

The icon border also inherits the quality color (1px, same `--slot-quality-color`).

### 8.7 Top Gear candidate row

```
Structure: <div class="candidate-row [winner|equipped-row|unchecked]">
  <input type="checkbox">     — 16×16, custom styled
  .cand-icon                  — 40×40px img, quality-colored border, radius-sm
  .cand-info
    .cand-name-row
      .cand-name              — 13px, quality-colored
      .cand-ilvl              — 11px, font-display, text-fg-muted, tabular-nums
      .badge                  — "Equipped" or "Winner" (see 8.12)
    .cand-meta-row
      .cand-source            — 11px, text-fg-muted
      .stat-tag × N           — 10px pill chips, bg-surface-overlay, border-border-subtle
  .cand-dps-col               — width: 130px, right-aligned
    .cand-dps                 — 13px, font-display, weight 600, tabular-nums
    .cand-delta               — 11px, font-display, delta-positive/negative/neutral
    .cand-bar-wrap + .cand-bar — 3px height proportional bar
```

| Row variant | Background | Bar color |
|------------|-----------|-----------|
| Default | transparent | `border-border` (`--ink-600`) |
| Hover | `bg-surface-inset` | (unchanged) |
| Winner | `rgba(201,162,78,0.06)` | `bg-accent` |
| Winner hover | `rgba(201,162,78,0.1)` | `bg-accent` |
| Equipped | `rgba(163,53,238,0.05)` | epic purple tint |
| Unchecked | opacity 0.6 | (unchanged) |

Checkbox: 16×16, `appearance: none`, `bg-surface-overlay`, 1px `border-border`, `rounded-sm`. Checked: `bg-accent`, `border-accent`, checkmark using `::after` pseudo with `border-color: --ink-950`.

The DPS bar is 3px high, `bg-bar-track` track, proportional fill (100% = winner). Bar color transitions: winner = `bg-bar` (gold), positive delta = green-400, negative delta = red-400 with 0.6 opacity.

### 8.8 WoW item tooltip

**Rendering path (decided — OVERALL_PLAN §6):** the item/spell tooltip is rendered by the **Wowhead "Power" script** from the item/spell id (+ `bonus=`/`ilvl=`/`gems=`/`ench=` mapped from the simc string) — zero markup of ours, game-authentic, no data bundle. The line-by-line spec below is retained as the **visual reference** for that game-authentic appearance (which Wowhead's tooltip already matches); we do not hand-build this tooltip in the normal path.

The tooltip must remain game-authentic regardless of UI theme changes. Players use it to verify item stats, not as a UI affordance — it should feel identical to the in-game tooltip.

**Integration (what we own vs. what Wowhead controls):** All we author is the **anchor** — the slot tile / ability row (the icon, quality border, and the `<a>`/`data-wowhead` attributes that hand Wowhead the id + `bonus=`/`ilvl=`/`gems=`/`ench=`). The **box, its layout, the line content, positioning, and the show/hide trigger are entirely Wowhead's** (its Power script reads the attributes and renders the floating tooltip). So the `--c-tooltip-*` tokens, the **Box** table, and the **Positioning** notes below are a *reference of the appearance we expect Wowhead to produce* — not styles or behavior we implement. We only fall back to authoring this markup ourselves if we ever drop the Wowhead embed (not planned for v1). Wiring lives in the `WowheadTooltip` wrapper (`ui/`) + the Power-script loader (`lib/`).

**Box** *(Wowhead-rendered — reference appearance, not styles we author):*

| Property | Value |
|----------|-------|
| Background | `bg-tooltip-bg` (`rgba(0,0,0,0.92)`) |
| Border | 1px, quality-colored (`border-quality-epic`, etc.) |
| Border-radius | 2px (minimal, game-like) |
| Width | 300–340px |
| Padding | 10px top/bottom, 12px sides |
| Font | `font-sans` (Inter), 13px body, left-aligned |
| Shadow | `shadow-lg` |

**Line-by-line order:**

1. **Item name** — 14.5px, weight 600, quality color (`text-quality-epic`, etc.)
2. **"Item Level NNN"** — 13px, `text-tooltip-ilvl` (wow-gold)
3. **"Upgrade Level: Hero 4/6"** *(optional)* — 12.5px, `text-tooltip-info` (wow-blue)
4. **"Legendary"** line for legendary quality *(optional)* — rendered in the legendary color
5. **"Soulbound" / "Unique-Equipped"** — 13px, `#e8e8e8` (near-white, not `text-fg`)
6. `<hr>` — 1px, `rgba(255,255,255,0.08)`, `margin: 5px 0`
7. **Slot and type row** — flex space-between, e.g. "Head" left / "Plate" right, 13px, `#e8e8e8`
8. **Armor value or weapon damage block** — 13px, `#e8e8e8`; weapon shows "X–Y Damage" + "(speed)" on one line, "N DPS" on next
9. `<hr>`
10. **Primary and secondary stats** — "+N Strength", "+N Stamina", etc., 13px, `#e8e8e8`
11. `<hr>`
12. **Socket + gem line** *(optional)* — small diamond SVG icon + "Setting Name +N Stat", `text-tooltip-info` (wow-blue)
13. **"Enchanted: +N Stat"** *(optional)* — `text-tooltip-effect` (wow-green)
14. `<hr>`
15. **"Equip:" / "Use:" proc line** *(optional)* — `text-tooltip-effect` (wow-green)
16. `<hr>`
17. **"Durability X / Y"** — 12px, `#b8b8b8`
18. **"Requires Level N"** — 12px, `#b8b8b8`
19. `<hr>` *(if flavor text follows)*
20. **Flavor text** — `text-tooltip-ilvl` (wow-gold), italic, 12.5px

Sections without optional content are omitted entirely (no empty `<hr>`s). The near-white body color (`#e8e8e8`) is used rather than `text-fg` (`--ink-100`) because the tooltip background is pure black, not the warm canvas color.

**Positioning** *(Wowhead-controlled):* Wowhead's script positions the floating tooltip itself (it flips side to stay in viewport) and shows/hides it on pointer hover of the anchor. The values that follow describe the in-game-like placement we expect — to the right of the anchor, flipping left in a right-column context, upward for weapon rows — but we do **not** set them; the only thing on our side is where the anchor sits in the layout. See §10 for the keyboard/focus accessibility caveat this introduces.

### 8.9 Stat list

A simple two-column label/value layout used in the report screen's scaling and stats blocks:

```
[STAT NAME label]    [22px font-display number + unit]
[subtitle / subtext]
```

The scaling grid renders as a CSS grid with 4 columns and 1px `border-border-subtle` gaps (the gap itself becomes the grid line). Each cell: `bg-surface-overlay`, `padding: 14px 16px`. Stat name: 10px, ALL CAPS, `text-fg-muted`. Value: 22px, `font-display`, weight 500, `tabular-nums`. Unit: 11px, `text-fg-muted` inline. Subtitle: 10.5px, `text-fg-muted`.

### 8.10 DPS headline block

```
Structure:
  [EYEBROW label]         — 10px, uppercase, tracked, text-fg-muted
  [number]  [DPS unit]    — text-7xl font-display weight-500 + accent unit
  [underline gradient]    — 1px, accent → transparent
  [error / iteration meta] — 12px text-fg-muted
```

The DPS number is `clamp(64px, 7vw, 96px)` in the report mockup (scales between `text-7xl` and larger). The "DPS" unit sits inline, `text-accent`, ~30px, `vertical-align: baseline; bottom: 6px` to optically align with the number baseline. The underline is a CSS gradient: `linear-gradient(90deg, accent, rgba(201,162,78,0.3) 60%, transparent)`.

The error / meta line below shows `target_error ±X%` and the iteration count in `font-mono` with `text-fg-muted`.

### 8.11 Ability breakdown row

Table layout. Columns: icon | name | DPS value | % of total | proportional bar | (advanced: casts, CPM, execute%).

```
[30×30 icon]  [Ability Name]     [123,456]   [18.4%]   [████░░░░░░]
              text-fg-muted      text-fg      text-fg-muted  3px bar
              text-sm            text-sm      text-xs
```

- Row background: transparent; hover: `bg-surface-inset`
- Dividers: `border-b border-border-subtle`; last row has no border
- Bar track: 3px, `bg-bar-track`, `rounded-sm`. Fill: `linear-gradient(90deg, accent, --gold-600)`, opacity 0.65; on row hover, opacity 0.9
- Advanced columns (Casts, CPM, Execute%) are hidden by default, revealed by the progressive-disclosure toggle

### 8.12 Buff uptime bar

Grid of cards, `minmax(220px, 1fr)`:

```
[Buff Name]              [NN.N%]
[████████████░░░░░░░░]   2px bar, accent, opacity 0.5
```

Card: `bg-surface-inset`, 1px `border-border-subtle`, `rounded-md`, `padding: 12px 14px`. Name: 12px, weight 500, `text-fg-muted`. Percentage: 13px, weight 600, `text-fg`, `tabular-nums`. Bar track: 2px, `bg-surface-raised`. Fill: `bg-accent`, opacity 0.5, `rounded-full`.

### 8.13 Distribution histogram

Used in the report DPS section to show the sim's output distribution.

- Canvas background: `bg-surface` (transparent on the report page, which has its own panel bg)
- Gridlines: horizontal, 1px, `bg-chart-grid` (`--ink-800`)
- Axis labels: `text-chart-axis` (`--ink-500`), `text-xs`, `font-mono`
- Bar fill: `bg-bar` (`--gold-400`)
- Mean marker: vertical line, `stroke-chart-mean` (`--gold-300`)
- Built with visx; colors are fed via token values read at render time — no hardcoded color strings inside chart components

### 8.14 Progressive-disclosure toggle ("Show advanced ▸")

```
Structure: <button class="toggle-btn [open]">
  <span>SHOW ADVANCED</span>
  <span class="toggle-arrow">▸</span>
```

| State | Border | Color | Background |
|-------|--------|-------|-----------|
| Collapsed | `border-border` | `text-fg-muted` | transparent |
| Collapsed hover | `border-accent` | `text-fg-muted` (secondary) | `bg-accent-subtle` |
| Expanded | `border-accent` | `text-accent` | `bg-accent-subtle` |

Arrow rotates 90° on expansion (`transition: transform 0.2s`). The controlled content (advanced block) appears below with `bg-surface-inset`, `border border-border-subtle`, `rounded-lg`.

### 8.15 Status chip (engine status)

```
Structure: <div class="engine-chip">
  <span class="engine-dot"/>  — 5px green dot + glow
  "8 cores · isolated"        — 10.5px, text-fg-muted
```

Pill shape (`rounded-full`), `bg-surface-overlay`, `border border-border-subtle`. The green dot color (`#3dd68c`) and its glow (`rgba(61,214,140,0.6)`) are not semantic tokens — they are a live readout indicator whose color is fixed regardless of theme (green = running, future states TBD). The text content is dynamic (from `EngineInfo`).

### 8.12 Quality badge

Small pill badges used in the Top Gear candidate list:

| Badge | Background | Text | Border |
|-------|-----------|------|--------|
| Equipped | `rgba(163,53,238,0.15)` | `text-quality-epic` | `rgba(163,53,238,0.3)` |
| Winner | `rgba(201,162,78,0.15)` | `text-accent` | `rgba(201,162,78,0.3)` |

Structure: `display: inline-flex; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase`.

---

## 9. Data Visualization

### DPS and delta semantics

| Color | Token | Usage |
|-------|-------|-------|
| Gold | `text-dps` / `bg-bar` | The single DPS value — the primary metric |
| Green | `text-delta-positive` | DPS gain vs. baseline (Top Gear) |
| Red | `text-delta-negative` | DPS loss vs. baseline |
| Neutral / muted | `text-fg-muted` | ± 0 baseline (no gain, no loss) |

Delta values in the Top Gear list always show an explicit sign (`+4,402` or `−860`). The baseline row shows `± 0 baseline` in `text-fg-muted`.

### Bar and track

Bar fills in the DPS breakdown table use a short gradient from `--c-bar` (gold-400) toward `--c-accent-dim` (gold-600) so the fill has subtle depth rather than a flat fill. Opacity is reduced to 0.65 at rest and 0.9 on hover.

Track background is always `bg-bar-track` (`--ink-800`). Track height: 3px for ability breakdown, 3px for candidate bars, 2px for buff uptime. All tracks use `rounded-sm` or `rounded-full`.

### Mono-gold vs categorical color

**Use mono-gold** (all bars/series in `--c-bar` / `--c-chart-1`) when the chart is single-series — DPS breakdown bars, buff uptime fills, the distribution histogram. This keeps the chart consistent with the UI accent.

**Use categorical hues** (`--c-chart-1` through `--c-chart-6`) only when two or more data series need to be distinguished — e.g. a comparative DPS chart across specs or a multi-series timeline. Assign hue-1 (gold) to the primary series so it is visually dominant; assign hue-2 through hue-6 to secondary series in order.

Never hardcode hex color strings inside visx chart components. Pass token values at render time:

```tsx
// Correct — read token at render, passed as prop
const barColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--c-bar').trim();

// Wrong — hardcoded hex bypasses the token system
<Bar fill="#c9a24e" />
```

### Chart-level style rules

- Grid lines: `--c-chart-grid`, 1px, horizontal only (vertical gridlines add noise)
- Axis labels: `--c-chart-axis`, `font-mono`, `text-xs`
- Mean/reference lines: `--c-chart-mean`, dashed or solid, clearly distinct from bar fills
- No chart background fill (charts sit on whatever surface they are placed on)
- No drop shadows on data elements (shadows are reserved for floating UI elements)

---

## 10. Accessibility

### Contrast intent

| Pairing | Token pair | WCAG target |
|---------|-----------|-------------|
| Body text on canvas | `text-fg` on `bg-surface` | AA (≥4.5:1) |
| Secondary text on canvas | `text-fg-muted` on `bg-surface` | AA for large text |
| Accent as UI indicator (borders, icons) | `text-accent` on `bg-surface` | AA for large text (3:1 UI) |
| Accent text on gold fill (button) | `text-accent-fg` on `bg-accent` | AA |
| Danger text | `text-danger` | AA for large text |

Gold (`--gold-400 #c9a24e`) on the dark canvas (`--ink-950 #0e0c0a`) achieves approximately 4.5:1 contrast for large text and UI components (borders, active indicators), meeting AA. For small body text at accent color, use `text-accent-hover` (`--gold-300`) which is lighter and reaches the full AA body threshold. The design intentionally does not use gold for small body text — it is reserved for interactive affordances and large numbers.

### Focus management

- All interactive elements receive a visible focus ring when navigated by keyboard
- Focus ring: `outline: 2px solid var(--c-focus)` (`--gold-300`), `outline-offset: 2px`. This is set on `:focus-visible`, not `:focus`, to avoid showing it on mouse click
- Radix UI primitives and React Aria components provide built-in focus management; we rely on them rather than reimplementing roving tabindex or trapping logic
- The `<Dialog>` (popover, modal) traps focus correctly via Radix

### Body size floor

No body text, data row text, or interactive label goes below 14px (`text-sm`). The 12px (`text-xs`) size is permitted only for non-body decorative text: badge labels, column header eyebrows in ALL CAPS, the ilvl overlay badge on slot icons.

### Tabular numerals

The `body` base rule in `theme.css` sets `font-variant-numeric: tabular-nums` globally. DPS numbers, deltas, ilvl values, and all data table cells therefore render with fixed-width digits by default. Reinforce with the `tabular-nums` Tailwind utility on any container where numeric alignment is load-bearing (tables, candidate DPS columns).

### Keyboard targets

All slot tiles, candidate rows, and toggle buttons receive `tabindex="0"` when interactive. **Caveat — the WoW item/spell tooltip is now Wowhead-rendered (§8.8) and is pointer/hover-driven; it is not focus- or keyboard-triggerable out of the box and is not ARIA-compliant.** Keyboard users therefore cannot read item stats via that tooltip. Mitigations: anchor each item to its Wowhead page (`<a href>` is keyboard-reachable and announces the item), keep the item name/ilvl/quality visible in the tile itself (not tooltip-only), and treat a focus-triggerable custom tooltip as a later accessibility enhancement if we ever drop the Wowhead embed. Do not claim full keyboard parity for tooltip content while the Wowhead embed is the rendering path.

---

## 11. Token Discipline & Enforcement

### How "tokens or nothing" is enforced mechanically

**Tailwind default palette stripped.** In `theme.css`, the `@theme` block opens with `--color-*: initial`, `--font-*: initial`, `--text-*: initial`, `--radius-*: initial`, `--shadow-*: initial`. This tells Tailwind v4 to discard its default scales entirely. The result: `text-blue-500`, `rounded-3xl`, `shadow-xl`, `font-serif` do not exist as utilities and cannot be written in JSX. Off-token styles are **impossible by construction**, not by convention.

**ESLint bans arbitrary values.** The ESLint config (`eslint-plugin-tailwindcss` or equivalent) bans:
- Arbitrary value classes: `w-[137px]`, `text-[#abc]`, `p-[13px]`
- Inline `style={{}}` attributes outside the allowed list

CI fails on either violation. This means off-token styles also cannot be expressed as inline styles.

**The `style={{}}` allowlist (the only exceptions):**

1. Dynamic chart geometry: `style={{ width: `${pct}%` }}` or visx geometry props computed at render time (bar width, SVG coordinates). These are geometric values, not design tokens, and cannot be expressed as Tailwind utilities.
2. Raw token value swatches in the `/styleguide` route: `style={{ background: 'var(--c-surface)' }}` for swatch rendering. These are meta-UI, not component code.

Everything else must use a Tailwind utility.

**`prettier-plugin-tailwindcss`** canonicalizes class order so class attributes look the same across all files and diffs stay clean.

### Spacing on-grid

Spacing is left on Tailwind's 4px-grid multiplier. `p-4` = 16px, `gap-5` = 20px, etc. The ESLint ban on arbitrary values (`p-[13px]`) enforces the grid. Do not introduce custom spacing tokens unless a consistent sub-grid step is needed across the whole system.

### How to add a future theme

1. Open `src/theme/semantic.css`
2. Add one new block:
   ```css
   [data-theme='light'] {
     --c-surface: var(--ink-50);
     --c-surface-raised: var(--ink-100);
     /* ... remap all --c-* vars to primitives ... */

     /* DO NOT touch quality or tooltip tokens */
   }
   ```
3. Register the theme name in the `THEMES` constant (location TBD — likely `src/theme/ThemeProvider.tsx`)
4. Done — every component re-themes with zero JSX changes

The `--c-quality-*` and `--c-tooltip-*` tokens must **not** be remapped in the new block. Leave them inheriting from `:root` (where they are set to the WoW game constants).

### Adding a new semantic token

1. Add the primitive value to `tokens.css` if it doesn't exist
2. Add `--c-<name>: var(--<primitive>)` to the `:root, [data-theme='noir']` block in `semantic.css`
3. Add `--color-<name>: var(--c-<name>)` to the `@theme` block in `theme.css`
4. The utility `text-<name>` / `bg-<name>` / `border-<name>` is now available
5. Add the token to all future theme blocks at the same time (don't leave it unmapped)

---

## 12. References

### Source files

| File | Purpose |
|------|---------|
| `src/theme/tokens.css` | Primitive token definitions — source of truth for all raw values |
| `src/theme/semantic.css` | Semantic token mapping; the "noir" theme block |
| `src/theme/theme.css` | Tailwind `@theme` entry; strips defaults, registers utilities, sets base body styles |
| `src/app/` | ThemeProvider, `<html data-theme="...">` attribute management |
| `/styleguide` route | Interactive swatch grid of every token and primitive; the canvas for design review |
| `docs/mockups/gear.html` | Static mockup — Gear / Top Gear screen; source for component structure and sizing |
| `docs/mockups/report.html` | Static mockup — Sim Report screen; source for report layout, DPS headline, ability table |
| `docs/WEB_UI_PLAN.md` §2 | Theming architecture rationale and enforcement philosophy |
| `docs/OVERALL_PLAN.md` | Product and architecture context |

### Theme history

The previous placeholder design used a neutral, unthemed base — no named palette, no design direction. **"Editorial Noir"** replaced it as the approved theme at the start of the design phase. The `[data-theme='noir']` block in `semantic.css` is the canonical definition of the current look. The neutral placeholder is not preserved anywhere; this document and the token files are the authoritative record going forward.
