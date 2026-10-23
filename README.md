# mist glass · dsh skin

[中文版本](./README.zh.md)

A frosted-glass skin for the DeepSeek Harness web UI: a quiet stone-to-mist
desk, neutral white glass on top of it, and a single graphite accent.

## Screenshots

Light | Dark
---|---
<img src="screenshots/light.jpg" width="640" alt="mist glass light"> | <img src="screenshots/dark.jpg" width="640" alt="mist glass dark">

## What makes it glass

- **A desk to look through.** The body carries a low-saturation stone-to-mist
  gradient with a neutral vignette. The whole app floats on it with a 14 px
  margin, so the glass has an edge to be glass against.
- **No hue anywhere but the semantics.** Greys, ink, hairlines and shadows are
  all neutral. Only success, warning and error keep their colours.
- **One accent.** Graphite (inverted to near-white in dark mode), used solid on
  the *new session* button, the *send* button and switches. No gradients, no
  glow.
- **One shadow language.** Every pane is `1 px inner rim + 1 px inner top
  highlight + a 0.5 px outer hairline + a soft neutral shadow`.
- **Four radii, no more.** 8 / 12 / 16 / 18 px plus `corner-shape:
  superellipse(1.6)`.
- **System type.** SF and PingFang for both headings and body, with no remote
  fonts.
- **Contrast is measured on the real glass.** Ink / muted / faint are checked
  against the rendered pane: 15:1 / 8:1 / 4.9:1 in light mode and
  11:1 / 7:1 / 4.9:1 in dark mode.
- **Falls back gracefully.** `prefers-reduced-transparency` returns panes to
  solid fills, `prefers-reduced-motion` drops every transition.

## Top bar instead of an icon rail

Laid out like Claude Code: a collapsed sidebar leaves nothing behind on the
left. Its 56 px icon rail is gone, and the canvas glass fills the whole window.

- The top-left corner holds two ghost buttons: the sidebar toggle and *new
  session*. They share the conversation header's row, and the session title
  moves right to make room for them, so the header is the top bar.
- Everything else from the rail (plugins, automations, workspace tools,
  balance, settings) lives only in the expanded sidebar.
- The toggle stays on the same pixel whether the sidebar is open or closed. In
  the expanded sidebar it replaces the brand row (whale and wordmark), and the
  graphite *new session* button sits right below it.
- The secondary header items (agent team, preset, open-in-Finder, ⋯) fade in
  only while the pointer is in the top bar, focus is inside it or one of their
  menus is open. On touch screens they stay visible. On narrow windows the
  agent team / preset pair is dropped so the title keeps its room.

How it works: dsh's layout already has this arrangement for its Windows desktop
title bar. `lib/topbar.js` sets `data-windows-titlebar` on `<html>`, which
makes the collapsed column 0 px wide and pins the two buttons. It sets the title
bar height to `0px` and adds `data-kg-topbar`, and section 6b of `skin.css`
does the placement. Everything there is keyed on `data-kg-topbar`, so a real
Windows or macOS desktop build is left alone. It does not use
`data-platform="darwin"`: the shortcuts package treats that as the Electron
runtime. If a dsh upgrade brings the rail back, start at
`dsh-client-ui-layout` (`collapsedWidth`) and the `[data-windows-titlebar]`
rules in `dsh-client-ui-sidebar`.

## Tooltips inside the glass

The sidebar, canvas and right panel all use `backdrop-filter`, which makes each
of them the containing block for `position: fixed` children. dsh's tooltips are
fixed and placed in window coordinates, so without help they shift by the
pane's origin. In the canvas that is 294 px when the sidebar is open, enough to
push a tooltip off-screen. `lib/tooltip-fix.js` measures the real origin when a
tooltip appears or moves, cancels it with `translate`, and pulls tooltips near
an edge back inside the pane. To place one tooltip by hand in pane coordinates
(as the expanded sidebar toggle does), use `translate: none !important`. Menus
use CSS anchor positioning and are unaffected.

## Hover to open the sidebar

The skin also adds one small behaviour: while the sidebar is collapsed, resting
the mouse on the sidebar toggle in the top-left corner (about 0.15 s) opens it,
no click needed. It stays open; close it as before with the same toggle or
⌥⌘B. Mouse only, so touch input is unaffected.

## Install

Three steps:

**1.** Add a line to `dependencies` in `~/.dsh/profiles/web/package.json`:

```json
"dsh-skin-kawaii2000": "github:shunkwon/dsh-skin-kawaii2000"
```

**2.** Add a block to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: skin-kawaii2000
      name: dsh-skin-kawaii2000
```

**3.** Install and restart dsh:

```bash
cd ~/.dsh/profiles/web
pnpm install
```

Done. Open http://127.0.0.1:3080 to see the skin.

> The package id is still `dsh-skin-kawaii2000`, and so is the loader row. The
> look has changed twice: 2.0 swapped the 2000s bevels for candy glass, and 3.0
> took the candy colours out. Keeping the id means an existing profile picks up
> each version without touching the patch. The v1 look is tagged
> `v1-kawaii2000` in git. The v2 candy glass is commit `d48950b`.

### Want to disable it?

Add `disabled: true` to that patch line and restart, or remove both additions above.

## License

[MIT](./LICENSE)
