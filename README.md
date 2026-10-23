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

## Hover to open the sidebar

The skin also adds one small behaviour: while the sidebar is collapsed, resting
the mouse on the whale icon in the top-left corner (about 0.15 s) opens it, no
click needed. It stays open; close it as before with the collapse button at the
sidebar's top right or ⌥⌘B. Mouse only, so touch input is unaffected.

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
