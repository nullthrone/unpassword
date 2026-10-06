# Nullthrone Design System (vendored)

Tokens and brand assets from the Nullthrone Design System handoff (Claude Design export, 2026-10-04), used by the web app (`web/`) and the documentation site (`site/`).

- `tokens/colors.css`, `typography.css`, `spacing.css`, `effects.css`, `motion.css` and `base.css` are copied unchanged.
- `tokens/fonts.css` replaces the original Google Fonts import with self-hosted files in `fonts/` (Jost, Public Sans, JetBrains Mono, all SIL OFL 1.1). unpassword makes no third-party requests for fonts.
- `assets/nullthrone-mark.svg` and `assets/nullthrone-lockup.svg` are the umbrella brand marks. They fill with `currentColor`.
- `nullthrone.css` imports everything in the original order.

## Rules that matter most

These are summarised from the design system README.

- Ink (`--ink-950`) on warm paper (`--paper`). Brass (`--brass-500`) is the single accent, used at most once per view for the primary call to action.
- Corners are square. Structure comes from 1px hairlines. The double rule (two hairlines 3px apart) marks major section breaks.
- Display type and uppercase labels use Jost with `--track-caps`. Body text uses Public Sans, code uses JetBrains Mono.
- Shadows are near-flat. No gradients, no transparency, no blur, no emoji.
- Dark mode inverts the primitives. It follows the OS preference, and `data-theme` overrides it.
- Voice: declarative and precise. No hype, no hedging.

Do not edit the copied token files. Override in the consuming stylesheet instead.
