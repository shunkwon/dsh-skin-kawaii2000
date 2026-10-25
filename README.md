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
  on it) for about 0.3 s and it slides back. Move back over it while it is
  sliding away and it comes back. It stays out while a menu opened from it is
  showing, while you type in its search box, and while a mouse button is held.
- **Pin:** press ⌥⌘B while it is out. The card docks against the left edge, the
  content moves aside and the sidebar stays, as an expanded sidebar always did.
  ⌥⌘B again slides it away and the content fills the window. The shortcut is
  read from the app's own binding, so a remapped one works too.
- Touch screens have no hover, so they keep the sidebar toggle in the top-left
  corner.

Only the sidebar itself moves. The content never animates: it either stays
put, or moves aside or fills the window once, after the sidebar has stopped.
A peek and its retract never re-lay out the content at all.

It lives in `lib/sidebar-peek.js`, which keeps its state in `<html
data-kg-side>` as space-separated words: `overlay` (the canvas spans the
sidebar column too, so its box doesn't change), `card` (the floating card look),
and `hidden` / `leaving` (the sidebar placed / sliding off the window's left
edge). `skin.css` keys on those words, and the only animated property is the
sidebar's `transform`. The layout's own column-width transition is turned off,
so the column snaps open and shut. To switch the sidebar it presses the app's
own shortcut, which renders about half as much as clicking the toggle, and
clicks the toggle only if that doesn't work.

Why: in a long conversation (7,000+ nodes) one change of the canvas width
costs WebKit, the engine DeepSeek.app runs on, 60–90 ms of layout and paint.
The old version animated the column width and a matching negative margin on
the canvas, so it paid that on every frame and dropped six or seven frames per
peek. Now it is paid once, while the sidebar is still, and the slides
themselves drop no frames.

**Maintenance note:** expanding or collapsing the sidebar changes a few
inherited CSS variables: the layout sets `--dsh-windows-sidebar-width` on the
frame, and ui-sidebar sets `--dsh-windows-menu-start` on the root. When an
inherited variable changes on an ancestor, WebKit restyles every node beneath
it, 34 ms or more per change in a long conversation. `skin.css` pins the first
to a constant on the canvas and sidebar columns, pins the second outright, and
gives `--dsh-frame-leading-clearance` the same value in every state (in
DeepSeek.app, where the title has to clear the traffic lights, the offset is set
on the header alone). If you add a variable that follows the sidebar state,
don't set it on the frame or the root.

## Search results jump to the match

When the sidebar search (⌥⌘K) finds text inside a conversation, clicking a
result opens the session and scrolls to where the keyword is. That spot gets a
darker yellow mark and the other matches in the session a light one; the
keyword is also marked in the result titles and snippets. The app itself only
opens the session and stays at the bottom, so the skin adds the rest.

- If the keyword is in older history, it presses *Load earlier* (up to 10
  pages) and looks again.
- With several matches it picks the one whose surrounding words best match the
  result snippet, since the snippet is the search backend's best match.
- If the app pulls the view back to the bottom within 3 s of the jump, it
  scrolls back. Once you scroll, click or press a key yourself, it lets go.
- Switching to another session clears the marks.
- Text inside collapsed tool calls or reasoning isn't on the page; then the
  session just opens without a jump.

The code is `lib/search-jump.js`. Marks use the CSS Custom Highlight API
(`CSS.highlights`, no DOM changes), coloured by `--kg-find` /
`--kg-find-current` in `skin.css`.

## In DeepSeek.app: the top bar is the titlebar

DeepSeek.app (the WKWebView wrapper in the Dock, source in
`~/Library/Application Support/DeepSeekWebApp`) has no titlebar row of its own.
As in Claude Code, the traffic lights sit at the left end of the page's top
bar, and empty space in that row drags the window:

- **Collapsed:** the session title starts right after the traffic lights and
  its row is centred on them.
- **Sidebar out (pinned or peeking):** the sidebar keeps that row free for the
  traffic lights, and 新会话 sits just below it.
- Double-clicking empty space in the row does what System Settings › Desktop &
  Dock says (minimize, zoom, or nothing).
- In full screen the traffic lights hide, and the layout goes back to the
  browser one.

The app and the skin meet through a small contract on `<html>`, which the app
sets from a document-start script:

- `data-native-titlebar`: the traffic lights are showing (removed in full
  screen).
- `--native-titlebar-height`: the row's height, twice the traffic lights'
  centre line (52px on macOS 26).
- `--native-controls-end`: the right edge of the zoom button (79px).

WebKit has no `app-region`, so the app does the dragging. The page only
reports whether the pointer is over empty space in that row: nothing clickable
under it, and no menu or dialog open. The app then takes a plain press there
as a window drag before the page ever sees it.

With that attribute set, `skin.css` (end of section 6b) does the following:

- Makes the conversation header exactly that row.
- Moves the title past the traffic lights while the sidebar is collapsed or
  peeking.
- Starts the sidebar's content below the row.
- Pushes the plugin and automation page titles below it, as dsh's own macOS
  build does.
- Keeps dialogs clear of it.
- Moves the full-screen right panel's tab strip past the traffic lights.

`lib/sidebar-peek.js` ignores the left edge inside that row, so reaching for
the close button doesn't pull the sidebar out. Browsers never get the
attribute, so none of this applies there. Without this skin the traffic lights
would cover the session title.

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
