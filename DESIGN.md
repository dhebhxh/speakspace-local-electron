---
name: "SpeakSpace"
description: "A private corpus index desk that turns speech into traceable local knowledge."
colors:
  dark-background: "#07101d"
  dark-canvas: "#0a1423"
  dark-rail: "#081526"
  dark-surface: "#101d2d"
  dark-surface-strong: "#152335"
  dark-surface-soft: "#1a2a3d"
  dark-surface-raised: "#203146"
  dark-text: "#f3f7fb"
  dark-muted: "#9cacbd"
  dark-subtle: "#718397"
  dark-cobalt: "#4f82ff"
  dark-cobalt-strong: "#2f6bff"
  dark-cobalt-soft: "rgba(79, 130, 255, 0.14)"
  dark-teal-verified: "#38d2bc"
  dark-amber-caution: "#f2b84b"
  dark-coral-danger: "#ff6b66"
  dark-border: "rgba(184, 207, 230, 0.14)"
  dark-border-strong: "rgba(184, 207, 230, 0.24)"
  dark-focus: "#89aaff"
  light-background: "#e8edf3"
  light-canvas: "#edf1f5"
  light-rail: "#0b1728"
  light-surface: "#f8fafc"
  light-surface-strong: "#ffffff"
  light-surface-soft: "#eef2f6"
  light-surface-raised: "#ffffff"
  light-text: "#152030"
  light-muted: "#586b7e"
  light-subtle: "#758699"
  light-cobalt: "#245be0"
  light-cobalt-strong: "#174fd8"
  light-cobalt-soft: "rgba(47, 107, 255, 0.1)"
  light-teal-verified: "#087f70"
  light-amber-caution: "#a86700"
  light-coral-danger: "#c93f3a"
  light-border: "rgba(42, 61, 81, 0.13)"
  light-border-strong: "rgba(42, 61, 81, 0.23)"
  light-focus: "#174fd8"
  white: "#ffffff"
  ready-green: "#22c55e"
typography:
  headline:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(1.55rem, 2.7vw, 2.25rem)"
    fontWeight: 720
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 720
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.64rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-5: "1.25rem"
  space-6: "1.5rem"
  space-8: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.dark-cobalt-strong}"
    textColor: "{colors.white}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 1rem"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.dark-surface-soft}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.sm}"
    padding: "0.68rem 1rem"
    height: "42px"
  field:
    backgroundColor: "{colors.dark-surface-strong}"
    textColor: "{colors.dark-text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.8rem 0.9rem"
  rail-item-active:
    backgroundColor: "{colors.dark-cobalt-soft}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.75rem"
    height: "44px"
  scope-active:
    backgroundColor: "{colors.dark-cobalt}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "0.35rem 0.55rem"
    height: "30px"
  verified-local-status:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.md}"
    padding: "0.8rem"
  workspace-index-row:
    backgroundColor: "transparent"
    textColor: "{colors.dark-text}"
    rounded: "0"
    padding: "0.9rem 0.65rem"
    height: "76px"
  settings-option:
    backgroundColor: "{colors.dark-surface-soft}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.sm}"
    padding: "0.9rem"
    height: "66px"
  model-module:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.md}"
    padding: "1.1rem"
---

# Design System: SpeakSpace

## Overview

**Creative North Star: "The Corpus Index Desk / 语料索引台"**

SpeakSpace is a linguistic concordance and field-recording desk: speech becomes traceable knowledge on one continuous working surface. Frosted index-paper fields sit beside a carbon-navy equipment rail; cobalt rules mark selection and provenance, teal confirms verified local operation, amber calls for care, and coral is reserved for failure or destructive recording state.

The interface is compact, calm, and operational. It keeps familiar desktop affordances, bilingual copy, and the complete path from capture or import through transcript inspection, local-model inquiry, and workspace preservation. It explicitly rejects the generic purple AI card dashboard: hierarchy comes from ruled fields, index rows, and bounded equipment modules rather than decorative gradients or floating card piles.

**Key Characteristics:**

- A continuous desktop shell with a compact carbon equipment rail.
- Frosted index-paper surfaces divided by hairline rules.
- Cobalt used as annotation and active-state structure, not ambient decoration.
- Teal verified-local, amber caution, and coral danger states with text or shape reinforcement.
- Dense humanist system typography that remains readable in English and Simplified Chinese.
- Responsive reflow that preserves the recording-to-knowledge sequence.

## Colors

The palette pairs cool carbon and frost neutrals with a disciplined cobalt annotation voice and explicit semantic states; the frontmatter is the normative dark/light theme map.

### Primary

- **Cobalt Annotation:** Marks primary actions, selected records, focus relationships, and source references.
- **Strong Cobalt Action:** Carries high-commitment actions such as send and the `SS` application mark.

### Secondary

- **Verified Local Teal:** Confirms that processing or a runtime is available locally and private.
- **Amber Caution:** Identifies recommendation, attention, and module-specific caution without competing with primary actions.

### Tertiary

- **Coral Danger:** Reserved for recording activity, destructive actions, and errors.

### Neutral

- **Carbon Rail:** Keeps persistent product navigation visually separate from the working field in both themes.
- **Midnight Canvas and Index Fields:** Layer the dark theme through small tonal steps rather than dramatic contrast jumps.
- **Frost Canvas and Index Fields:** Form the light theme's cool paper-like desk, with white reserved for the strongest fields.
- **Ink, Muted Ink, and Subtle Ink:** Establish readable content, metadata, and de-emphasized instrumentation.
- **Hairline Borders:** Divide rows and zones; stronger borders bound the Studio desk and compound settings shell.

### Named Rules

**The Annotation Rule.** Cobalt marks a relationship, selection, focus, or decisive action; it does not wash whole screens in brand color.

**The Semantic State Rule.** Teal means verified local, amber means caution or recommendation, and coral means danger, recording, or failure; never swap these roles for variety.

## Typography

**Display Font:** Not used; this is an operating desk, not a promotional surface.
**Body Font:** Segoe UI Variable Text (with Segoe UI and system UI fallbacks)
**Label/Mono Font:** The same system family; compact labels use weight and tracking instead of a separate display face.

**Character:** The humanist system stack is crisp at dense desktop sizes and supports both English and Simplified Chinese without a visual seam. Headlines are compact and confident; labels behave like index annotations rather than marketing eyebrows.

### Hierarchy

- **Headline** (720, fluid compact scale, tight tracking): Page titles and major surface headers.
- **Title** (720, compact scale, tight tracking): Zone headings, model identities, note titles, and settings groups.
- **Body** (root 16px, 1.5 line-height): Transcript, conversation, description, and form content; paragraphs are generally limited to 72 characters per line.
- **Label** (700, compact scale, 0.08em tracking): Navigation groups, indexes, metadata, and operational annotations; uppercase is used only where the component already behaves as an index label.

### Named Rules

**The Instrument Type Rule.** Prefer compact hierarchy, stable numerals, and short labels; never introduce display-hero typography into operational surfaces.

## Layout

The desktop shell is a 224px navigation rail plus a minmax content field with 1.25rem padding. Studio is the signature continuous desk: a 220–248px note index, a dominant minmax conversation field, a 260–320px source context, and a composer anchored across the working edge. The work is sequential even when displayed in parallel: capture or import, inspect, ask, preserve.

At 1040px the source context hides and Studio becomes two columns. At 960px the shell rail becomes a sticky horizontal equipment bar. At 820px settings and split operational grids collapse to one column. At 760px Studio becomes a 150px note index above the conversation field, and at 560px the composer becomes a stacked tools/input/send sequence. The smallest rail treatment keeps 44px icon targets and hides labels rather than compressing them into illegibility.

Spacing follows the implemented quarter-rem rhythm from 0.25rem through 2rem. Prefer hairline dividers and aligned internal padding over free-floating gaps. Workspace directories are single-column indexed rows, settings are a bounded category-and-content compound surface, and model management uses a two-column module grid that collapses to one column below 780px.

**The Continuous Desk Rule.** Preserve the source-to-knowledge reading order across breakpoints; reflow zones instead of turning them into unrelated cards.

## Elevation & Depth

The system is flat by default. Tonal layering, borders, ruled backgrounds, and adjacent fields carry most depth; ordinary cards, rows, settings panels, and model modules have no shadow. Raised shadows are reserved for modal dialogs, menus, and the application mark, while a three-pixel cobalt-soft ring communicates field focus.

### Shadow Vocabulary

- **Ambient Surface** (`0 18px 48px rgba(0, 7, 17, 0.28)` dark; light theme substitutes its mapped value): Legacy ambient token, used sparingly outside the flattened system locks.
- **Raised Overlay** (`0 26px 70px rgba(0, 7, 17, 0.38)` dark; light theme substitutes its mapped value): Dialogs and focused overlays only.
- **Brand Mark Lift** (`0 10px 28px rgba(15, 73, 209, 0.26)`): The compact `SS` rail mark.
- **Focus Ring** (`0 0 0 3px var(--accent-soft)`): Inputs and model selectors when focused or expanded.

### Named Rules

**The Edge-Before-Elevation Rule.** Use a border or tonal step for ordinary structure; use a soft offset shadow only when a surface truly leaves the desk, never both as decoration.

## Shapes

The core radius scale is compact: gently curved controls at 8px, compound panels at 12px, and dialogs at 16px. Continuous desk zones, headers, index rows, and settings-panel seams are square where adjacency matters. Pills are limited to scope, metadata, or tiny source chips; circular geometry is reserved for status dots, spinners, and icon-only controls.

Hairline borders establish the index-desk form. A two-pixel cobalt rule may attach to the leading edge of an active row, and ruled transcript/conversation fields use a subtle repeating two-rem baseline. Clipping belongs to compound shells and overlays, not every nested surface.

**The Compact Radius Rule.** Use 8–16px corners for equipment and fields, square shared edges, and reserve fully rounded shapes for genuinely compact tokens or status.

## Components

### Buttons

- **Shape:** Compact equipment controls use the small radius and a 42px global minimum height; Studio can tighten to 40px without losing its target.
- **Primary:** Strong cobalt with white text and restrained horizontal padding; hover brightens the fill and active presses down by 1px.
- **Hover / Focus:** State transitions run at 160ms ease-out; keyboard focus is a two-pixel focus outline with a two-pixel offset.
- **Secondary / Tool:** Transparent or soft-index-field fill with an explicit hairline border; record uses coral only while recording.

### Chips

- **Style:** Source and metadata chips use muted ink, hairline borders, compact padding, and pill geometry.
- **State:** Selected scope fills with cobalt; recommendation is amber, verified/current is teal or green, and inactive remains neutral.

### Cards / Containers

- **Corner Style:** Compound equipment panels use the medium radius; index rows and joined panels stay square at shared edges.
- **Background:** Use the current theme's surface, strong surface, and soft surface tokens to create readable steps.
- **Shadow Strategy:** Flat at rest; only menus and dialogs rise.
- **Border:** One-pixel theme border, strengthened around compound work desks.
- **Internal Padding:** Dense 0.65–1.25rem padding, following the spacing scale.

### Inputs / Fields

- **Style:** Strong index-field background, small radius, theme hairline border, and clear text/caret color.
- **Focus:** Cobalt border plus a three-pixel soft cobalt ring; never remove the global focus-visible outline from keyboard interaction.
- **Error / Disabled:** Coral message and border for error; disabled controls retain shape and use 0.48 opacity with a not-allowed cursor.

### Navigation

The rail uses 44px rows, compact icons, and semibold labels. Hover adds a quiet cool-blue field; active state adds a cobalt-tinted field plus a two-pixel leading annotation rule. At 960px it becomes a sticky horizontal bar; at 620px labels disappear and icons keep 44px targets.

### Studio Desk

The Studio shell is one bordered surface with note index, ruled conversation field, knowledge context, and anchored composer. Note rows are divided like an index, user messages receive a cobalt tint, linked notes become compact pills, and recording/upload remain visible directly above the question field.

### Workspace Index Row

Workspace directory entries are 76px indexed rows, not tiles: two-digit index, compact workspace glyph, single-line name, metadata, and directional affordance. Hover uses the soft cobalt field without changing the row's ruled geometry.

### Settings Option

Settings uses a category rail joined to a continuous content field. Options are 66px radio-like rows with a small preview or glyph, label and description, and a visible selected check; the selected state uses a cobalt border and soft cobalt fill.

### Model Module

Each local capability is a medium-radius equipment module with identity, readiness status, and a rich model selector. Metadata remains compact and wrapped; the selector rotates its chevron, gains a module-tinted ring when open, and exposes explicit download or delete actions.

### Verified Local Status

The bottom-rail status uses a teal dot, short privacy explanation, and the system's only pointer-following spotlight. The spotlight fades in over 220ms on hover or focus-within and is completely removed on touch or reduced-motion systems.

**The State Is Structural Rule.** Express active, current, recording, pending, and failed states with border, fill, text, and icon changes together; never rely on color alone.

## Do's and Don'ts

### Do:

- **Do** keep Studio legible as one uninterrupted route from source material to preserved knowledge.
- **Do** use cobalt rules and fills to make selection, focus, provenance, and primary action inspectable.
- **Do** preserve the carbon rail against both light and dark work fields.
- **Do** keep keyboard focus visible, 44px compact navigation targets, responsive reflow, and complete reduced-motion fallback.
- **Do** use teal, amber, and coral only for their verified-local, caution, and danger meanings.

### Don't:

- **Don't** return to a generic purple AI dashboard or a wall of interchangeable gradient cards.
- **Don't** detach recording controls into an ornamental floating hero; keep them anchored to the working desk.
- **Don't** add shadows to ordinary rows, panels, or model modules when a hairline or tonal step already establishes structure.
- **Don't** round shared seams or index rows into isolated pills and tiles.
- **Don't** introduce display fonts, oversized hero type, decorative motion, or cloud-service implications.
