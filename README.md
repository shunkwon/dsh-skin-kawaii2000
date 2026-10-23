# candy glass · dsh skin

[中文版本](./README.zh.md)

A frosted-glass skin for the DeepSeek Harness web UI: a saturated candy desk,
and everything on top of it is milky glass — rose, lilac and sky showing through.

## Screenshots

Light | Dark
---|---
<img src="screenshots/light.jpg" width="640" alt="candy glass light"> | <img src="screenshots/dark.jpg" width="640" alt="candy glass dark">

## What makes it glass

- **A desk to look through.** The body carries a saturated candy aurora with a
  vignette; the whole app floats on it with a 14 px margin, so the glass has an
  edge to be glass against.
- **One shadow language.** Every pane is `1 px outer rim + 1 px inner top
  highlight + a coloured soft shadow`. No grey shadows anywhere.
- **Four radii, no more.** 8 / 12 / 16 / 22 px plus `corner-shape:
  superellipse(1.6)` so corners read like a sugar cube instead of a CSS circle.
- **Saturation is rationed.** Only two things are allowed to be saturated — the
  *new session* button and the *send* button. Everything else stays milky, which
  is what makes those two read as actions.
- **Contrast is measured on the real glass.** Ink, muted and link colours are
  checked against the rendered pane (13:1 / 7.5:1 / 5.2:1 in light mode).
- **Falls back gracefully.** `prefers-reduced-transparency` returns panes to
  solid fills, `prefers-reduced-motion` drops every transition.

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

Done — open http://127.0.0.1:3080 and enjoy the glass ✨

> The package id stays `dsh-skin-kawaii2000` (and so does the loader row): 2.0
> replaced the 2000s bevel look with frosted glass, but keeping the id means an
> existing profile keeps working without touching the patch. The v1 look is
> tagged `v1-kawaii2000` in git.

### Want to disable it?

Add `disabled: true` to that patch line and restart, or remove both additions above.

## License

[MIT](./LICENSE)
