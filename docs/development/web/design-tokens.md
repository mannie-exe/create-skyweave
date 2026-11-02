# Design tokens

[`tokens.css`](../../../web/src/styles/tokens.css) owns active reference values
and shared roles. [`typography.css`](../../../web/src/styles/typography.css),
[`composition.css`](../../../web/src/styles/composition.css) and
[`ui.css`](../../../web/src/styles/ui.css) apply them across Astro, React and
generated DOM. Page styles own composition and domain geometry.

## Ownership

| Layer     | Purpose                              | Examples                                                      |
| --------- | ------------------------------------ | ------------------------------------------------------------- |
| Reference | Palette, font stack and spacing seed | `ref-color-blue`, `ref-font-sans`, `ref-space-unit`           |
| Semantic  | A stable purpose across components   | `color-action`, `ink-muted`, `space-content`                  |
| Component | Independent geometry or treatment    | Recipe slots, workbench columns, selection marker direction   |
| Instance  | Data or a particular view state      | Graph coordinates, texture palette swatches, comparison split |

Reuse roles by meaning, not by equal values. Derive values when the relationship
should persist: control height follows its line box, padding and borders; a hover
surface follows its base surface and ink. Typography, spacing and shape remain
independently tunable. Do not add a global token for every measurement.

CSS custom properties resolve where declared. To override a base inside a subtree,
redeclare its derived roles there or set those roles directly. Changing a local
input does not recompute an inherited alias that already resolved at the root.
Keep dependencies one-way. There is no token compiler or theme service.

## Color, surfaces and state

| Roles                                                                                               | Meaning                                                                             |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `surface-page`, `surface-panel`, `surface-inset`, `surface-canvas`                                  | Page, contained content, recessed content and drawing surface                       |
| `surface-inverse`, `ink-inverse`                                                                    | Paired tooltip treatment                                                            |
| `ink`, `ink-muted`                                                                                  | Primary text and supporting metadata                                                |
| `line-subtle`, `line-control`                                                                       | Content separation and control boundaries; separate roles despite matching defaults |
| `color-action`, `color-action-hover`, `color-action-pressed`, `ink-on-action`                       | Links and primary actions                                                           |
| `surface-hover`, `surface-pressed`                                                                  | Neutral pointer interaction                                                         |
| `surface-selected`, `surface-selected-hover`, `ink-selected`, `ink-selected-muted`, `line-selected` | Persistent selection, including supporting text                                     |
| `ink-expanded`, `line-expanded`                                                                     | An open control's boundary/label; distinct from selected content                    |
| `color-destructive`, `surface-destructive-hover`, `surface-destructive-pressed`                     | Actions that remove content or discard edits                                        |
| `surface-disabled`, `ink-disabled`, `line-disabled`                                                 | Unavailable native controls                                                         |
| `color-focus`, `focus-width`, `focus-offset`                                                        | Keyboard focus, independent of selection                                            |
| `status-error-ink`                                                                                  | Errors and invalid fields                                                           |
| `status-info-surface`, `status-info-line`                                                           | Informational resource-review badges, not selection or job success                  |
| `surface-scrim`, `shadow-overlay`                                                                   | Modal backdrop and floating separation, derived from ink                            |

`Button` owns ordinary action states. `aria-pressed`, `aria-selected` and current
page/entry attributes drive selection; `aria-expanded` drives expansion. Callers
own the actual state. Hover does not replace selected ink. A selected button has
an inset marker as well as paint; its marker remains while temporarily disabled.
Disabled controls suppress interactive paint. Primary/destructive intents retain
their own treatment rather than inheriting selected navigation paint.

Collection geometry may adjust `--button-selection-shadow` locally, such as a
left marker for acquisition methods or a right marker for the map's family axis.
Do not recreate the selected color rules in page CSS. Resource thumbnails retain
an outline around the image; the resource reading rail retains its position marker.
Navigation links expose `aria-current`; map cells expose `aria-selected` while
retaining their bounded game-item layout.

Delete, remove, discard and removing a translation override use destructive intent.
Reload becomes destructive when it discards drafts. Resets, cancellation and
excluding a contributor from a temporary preview are neutral. Visible labels,
confirmation and reference guards remain caller-owned; color alone is insufficient.
Saving uses primary intent. Generating files is a separate operation.

## Typography

Use `data-text-role` when visual hierarchy differs from the HTML heading level.
Weak defaults map `h1` to page title, `h2` to section title and lower headings to
group title. Page selectors must not override explicit roles.

| Role            | Use                                          | Default size                 |
| --------------- | -------------------------------------------- | ---------------------------- |
| `page-title`    | Page heading                                 | 32px; 27px on narrow screens |
| `item-title`    | Selected item/object or authoring subject    | 1.75rem                      |
| `view-title`    | Survey, resource and compact editor headings | 1.375rem                     |
| `section-title` | Main content groups                          | 1.25rem                      |
| `group-title`   | Nested groups                                | 0.875rem                     |
| `body`          | Interface prose and controls                 | 14px                         |
| `reading`       | Longer resource descriptions                 | 1rem                         |
| `label`         | Field labels, summaries and navigation       | 0.8125rem                    |
| `caption`       | Supporting text and metadata                 | 0.75rem                      |
| `code`          | Source and identifiers                       | 0.75rem monospace            |

Full text roles carry family, size, weight, leading and tracking. Reading text
inherits body family/weight with its own size/leading. `type-meta-size` is a dense
metadata size; `type-view-title-*` is independent of item-title hierarchy.
`.scope` and `.muted` use the shared caption treatment on every page. Page CSS
must not make these classes available only in one view. Native labels and inputs
have separate label/body roles so wrapping an input in a label does not shrink it.

`pre` and `code` have shared source typography. Source panels are bounded,
scrollable and wrap long identifiers; `SourceEditor` keeps its own editable
textarea presentation. Caption and code text must remain readable when tokens or
browser zoom change. Brand lettering and zoom-scaled game/map labels retain
component-specific dimensions; they are not ordinary interface prose.

## Space, shape and measures

The spacing seed is 4px: `space-tight` 4px, `space-inline` 8px,
`space-control` 12px, `space-content` 16px and `space-section` 24px. Larger gaps
may derive from these roles when the relationship is intentional. Parent stacks
and rows own rhythm; children own content and intrinsic dimensions.

| Composition                    | Responsibility                                                                |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `content-stack`                | Vertical groups; default content gap, or `data-space="control"` / `"section"` |
| `action-row`                   | Centered peer actions and inline status                                       |
| `control-row`                  | Align labeled fields at their controls                                        |
| `control-note`, `inline-field` | Checkbox labels or explanatory text aligned to the control line               |
| `section-heading`              | Heading and actions, with a shared minimum row height                         |
| `editor-actions`               | Trailing actions with right-aligned persistent status                         |

Stack children have no outer block margins. Native `details` owns visibility;
`details.disclosure` contains a summary and a real `content-stack` body. Do not put
flex layout on `details` itself or rely on its anonymous content box to separate
inline content. Nested groups use nested stacks. This is a markup contract, not
a guarantee that arbitrary future HTML cannot overlap.

`control-min-block-size` derives from the body line box, vertical inline insets
and two control borders. `control-row` applies it to peer controls. Textareas share
native field insets; source editors keep code padding. Field layouts preserve
long labels, descriptions and validation messages. Icon buttons derive glyph and
target size from body typography and spacing; recipe slots remain independent.

`radius-control` and `radius-panel` distinguish controls and containers.
`measure-page`, `measure-inspector`, `measure-resource-browser` and responsive
`gutter-page` own shared bounds. Workbenches expose only sidebar width, sticky top
and list limit. Media aspect ratios, graph bounds, chart size and canvas height
remain local. Use overflow wrappers for wide tables instead of compressing their
content to unreadable sizes. Open survey panels retain their inset without a fill.

## Shared components

[`components/ui`](../../../web/src/components/ui) is the internal UI library;
Astro adapters remain static. No separate package or universal view schema is needed.

| Component                              | Contract                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `Button`                               | Native button, default type `button`, action intent and shared state paint |
| `IconButton`                           | Shared intent, Material glyph and accessible tooltip/name                  |
| `Field`, `fieldControl`, `createField` | Stable labels/descriptions/invalid state across React, Astro and DOM       |
| `SourceEditor`                         | Labeled code textarea and action slot; no persistence policy               |
| `Disclosure`, `createDisclosure`       | Native disclosure with a stacked body                                      |
| `Workbench`                            | Responsive browser/editor columns and bounded list                         |
| `ViewTabs`                             | Labeled native navigation; caller owns routing and state                   |
| `Feedback`, `setFeedback`              | Neutral/error message; errors remain distinct from action ink              |
| `EditorActions`                        | Actions and persistent status; no domain workflow                          |
| `SortableList`                         | Ordered selection, drag/manual operations and announcements                |
| `PreviewSurface`, `PreviewProgress`    | Preview containment and unobtrusive busy indication                        |

`Field` callers own validation and control behavior. React supplies generated
control attributes; Astro spreads `fieldControl(id, { hint, error })` onto its
slotted control. `SourceEditor` does not parse or save. Journal JSON, model JSON
and scenario YAML retain separate draft/persistence logic.

Activity has one header entry point. Roomy authoring pages may dock it; dense and
narrow pages use the overlay. Editor validation stays near its owner. Notifications
use `layer-notification`; tooltips use `layer-tooltip`. Dialog focus, dismissal,
unsaved changes and operation semantics are behavior, not token responsibilities.

## Domain boundaries

Recipe materials live in `recipes.css`, independently of application selection
and status. Slots keep fixed proportions, counts and pixel artwork. Item buttons
inside them do not adopt ordinary action fills. Resource checkerboards derive a
local material background from panel/ink; galleries use inset surfaces, not a
selected state merely because the old colors matched.

Coverage marks and notes live in `coverage.css`; minimap marks in `minimap.css`.
World unknown/origin colors and ore-profile paint stay scoped to their renderer.
These are data encodings, not job statuses. Selection must not change their meaning.

[`style-tokens.ts`](../../../web/src/lib/style-tokens.ts) resolves CSS colors into
sRGB for Canvas/Three.js in batches on redraw/setup, not per point/frame. World
labels read computed code typography. A Three.js scene needs remounting to pick
up changed setup colors; there is no live theme switcher. Physical light colors,
model dimensions, texture pixels, heat-scale calculations and graph positions
are content/rendering facts, not interface tokens.

## Accessibility and evolution

Keep native links, buttons, labels and disclosure keyboard behavior. `AppHeader`
provides Skip to content; each main page owns `main-content` with `tabindex="-1"`.
Use visible focus, descriptive action names and non-color cues. Icons must earn
their space and use the shared treatment; game imagery remains separate.

Respect reduced motion in spinners, sortable transitions and texture playback.
Animation must not hide required information. No new general motion system,
font dependency, dark theme or density preference is implied by these roles.

Review real wide/narrow views and enlarged text/spacing. Temporarily override a
token family to check computed styles and unintended consumers. Keep controls
aligned when labels wrap; permit local scrolling for tables and graphs. Automated
checks establish exercised behavior, not visual preference or complete accessibility.

Before removing a role, search styles, generated markup, inline values and renderer
mappings, including indirect references. Remove superseded overrides as adoption
progresses. Keep retained domain exceptions explicit. Update this document to the
implemented contract instead of accumulating proposed tokens and migration notes.

The direction follows Apple's [layout](https://developer.apple.com/design/human-interface-guidelines/layout),
[typography](https://developer.apple.com/design/human-interface-guidelines/typography)
and [color](https://developer.apple.com/design/human-interface-guidelines/color) guidance,
and Material's [token model](https://m3.material.io/foundations/design-tokens/overview).
Local references are cfgate's architecture/tokens and inherent.design's
`SITE-DESIGN.md`/site tokens. Borrow role ownership and derivation, not their brand
or page proportions. Verification commands and results belong in
[verification](verification.md).
