# mist glass · dsh skin

[中文版本](./README.zh.md)

A frosted-glass skin for the DeepSeek Harness web UI: a quiet stone-to-mist
desk, neutral white glass panes filling the window on top of it, and a single
graphite accent.

## Screenshots

Light | Dark
---|---
<img src="screenshots/light.jpg" width="640" alt="mist glass light"> | <img src="screenshots/dark.jpg" width="640" alt="mist glass dark">

## What makes it glass

- **A desk to look through.** The body carries a low-saturation stone-to-mist
  gradient with a neutral vignette, and the sidebar, canvas and right panel lie
  on it edge to edge, letting only a little warmth or coolness through. In 3.0
  the whole app floated on the desk with a 14 px margin and 20 px corners. From
  3.1 it is flush with the window (`--kg-window-inset` and `--kg-window-radius`
  are 0; set them back to 14 px / 20 px for the floating window). Only the
  sidebar that peeks from the left edge is still a separate rounded card,
  8 px off the edges.
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

- Nothing sits in the top-left corner: the conversation header's row is the top
  bar and the title starts at its left edge. New sessions come from ⌥⌘N or the
  sidebar's own button. Touch screens keep a sidebar toggle there, and the
  title moves right to make room for it.
- Everything else from the rail (plugins, automations, workspace tools,
  balance, settings) lives only in the expanded sidebar.
- The expanded sidebar has no brand row (whale and wordmark) any more: the
  graphite *new session* button goes right to the top, on the same line as the
  header's title row.
- The *conversation / trajectory* tabs move up into the top bar, so the header
  is a single 49 px row (79 px with the tab row before): title → tabs →
  open-in-Finder / ⋯ → right-panel toggle. The tabs are not removed: the
  trajectory view has no shortcut or command and the chosen view is remembered
  per session, so without them a session left on *trajectory* could not get
  back.
- Everything in the header except the title (agent team, preset, the tabs,
  open-in-Finder, ⋯, the right-panel toggle) fades in only while the pointer is
  in the top bar, focus is inside it or one of their menus is open. On touch
  screens they stay visible. ⇧⌘B also opens the right panel. Below 760 px of
  header width the agent team / preset pair is dropped, and below 520 px the
  tabs return to a line of their own, so the title always keeps its room.

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

## Pull the sidebar from the left edge

With a mouse there is no sidebar toggle button; the sidebar comes out of the
window's left edge instead:

- **Peek:** rest the pointer on the window's leftmost 8 px for about 0.12 s and
  the sidebar slides out as a floating glass card over the content, which does
  not move. A short vertical bar lights up at the left edge as the pointer
  approaches, to show where it comes from. Holding a mouse button (say, to
  select text from the left) never triggers it.
- **Retract:** move off the sidebar (24 px past its right edge still counts as
  on it) for about 0.3 s and it slides back. It stays out while a menu opened
  from it is showing, while you type in its search box, and while a mouse
  button is held.
- **Pin:** press ⌥⌘B while it is out. The card settles flush against the left
  edge, the content moves aside and the sidebar stays, as an expanded sidebar
  always did; ⌥⌘B again collapses it. The
  shortcut is read from the app's own binding, so a remapped one works too.
- Touch screens have no hover, so they keep the sidebar toggle in the top-left
  corner.

It lives in `lib/sidebar-peek.js`. A peek clicks the hidden toggle for you and
sets `data-kg-peek` on `<html>`. `skin.css` then gives the canvas a negative
margin as wide as the sidebar column, so the canvas covers that column again.
The margin and the column width run on the same transition, so the content
stays put as the sidebar slides in and out. `data-kg-peek` comes off only once
the collapse animation has finished.

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
