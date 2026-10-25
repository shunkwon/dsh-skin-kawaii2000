/*
 * 对比度体检 —— 粘到 DevTools 控制台里跑。
 *
 * 皮肤改的是 dsh 的颜色令牌，组件自己决定拿哪个令牌当字色、哪个当底色。两边配对
 * 不上时就是黑底黑字：dsh 的提示气泡字色直接用 static 色板
 * （--dsw-static-neutral-bluish-00），底色却用 alias，皮肤夜间表把 static 那一级
 * 反相成了深色，于是提示和快捷键键帽整个看不见（2026-10-25）。这类问题只在某个
 * 主题、某个弹层开着的时候才出现，读 CSS 很难找全，这个脚本在页面上直接量：
 *
 *   A. 字和图标：屏幕上每段文字、每个 svg 图标的颜色，对着它实际落到的底色
 *      （从 body 往下逐层叠 background-color，连同各层 opacity）算 WCAG 对比度，
 *      低于 3 的列出来。
 *   B. 夜间的亮面：夜间模式下底色偏白的元素。主按钮（新会话、发送、开关开态）
 *      本来就是近白的强调色，其余的要看一眼是不是漏翻了。
 *
 * 量不到的：backdrop-filter 和背景图（渐变）不参与计算；弹层底下透上来的别的
 * 内容也不算 —— 那种「两层字叠在一起」得看截图。
 *
 * 用法：
 *   1. 打开 http://127.0.0.1:3080，切到要检查的页面和主题；
 *   2. 把要查的弹层打开 —— 指针停在一个带快捷键的按钮上让提示出来、打开菜单；
 *   3. 粘下面整段，回车。对话、设置各页、插件页、右栏、首屏都跑一遍，白天夜间各一次。
 */

(() => {
  const MIN = 3
  const rgba = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c)
    if (!m) return null
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  // top 叠在 bottom 上
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a)
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
    const mix = (k) => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a
    return { r: mix('r'), g: mix('g'), b: mix('b'), a }
  }
  const luminance = (c) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (x, y) => {
    const a = luminance(x)
    const b = luminance(y)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }
  const ancestors = (el) => {
    const out = []
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) out.unshift(n)
    return out
  }
  const backdrop = (el) => {
    let bg = { ...rgba(getComputedStyle(document.body).backgroundColor), a: 1 }
    for (const n of ancestors(el)) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0) bg = over(c, bg)
    }
    return bg
  }
  const opacity = (el) => ancestors(el).reduce((o, n) => o * Number(getComputedStyle(n).opacity), 1)
  const onScreen = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
  }
  const name = (el) => {
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).slice(0, 2).join('.')
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '')
  }
  const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

  const low = new Map()
  for (const el of document.body.querySelectorAll('*')) {
    if (!onScreen(el)) continue
    const o = opacity(el)
    if (o < 0.05) continue
    let fg = null
    let text = ''
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())
    if (own.length && el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT') {
      fg = getComputedStyle(el).color
      text = own.map(n => n.textContent.trim()).join(' ').slice(0, 24)
    } else if (el.tagName === 'svg' && !el.parentElement.closest('svg')) {
      const shape = el.querySelector('path, circle, rect, line, polyline') || el
      const s = getComputedStyle(shape)
      fg = /rgb/.test(s.fill) && rgba(s.fill).a > 0 ? s.fill : /rgb/.test(s.stroke) ? s.stroke : getComputedStyle(el).color
      text = el.closest('[aria-label]')?.getAttribute('aria-label') || '(图标)'
    }
    const c = fg && rgba(fg)
    if (!c) continue
    const bg = backdrop(el)
    const r = ratio(over({ ...c, a: c.a * o }, bg), bg)
    if (r >= MIN) continue
    const key = name(el) + '|' + text
    if (!low.has(key)) low.set(key, `${r.toFixed(2)}  ${name(el)}  「${text}」  字 ${fg} 底 ${hex(bg)}${o < 1 ? `  opacity ${o.toFixed(2)}` : ''}`)
  }

  const light = []
  if (document.body.hasAttribute('data-ds-dark-theme')) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4 || !onScreen(el)) continue
      const c = rgba(getComputedStyle(el).backgroundColor)
      if (c && c.a >= 0.25 && (c.r + c.g + c.b) / 3 > 150) {
        light.push(`${name(el)}  「${el.textContent.trim().slice(0, 16)}」  ${getComputedStyle(el).backgroundColor}  ${r.width | 0}×${r.height | 0}`)
      }
    }
  }

  const out = []
  out.push(`== A. 对比度低于 ${MIN} ==`)
  out.push(low.size ? [...low.values()].sort().join('\n') : '  无')
  out.push('')
  out.push('== B. 夜间的亮面 ==')
  out.push(document.body.hasAttribute('data-ds-dark-theme') ? (light.length ? light.join('\n') : '  无') : '  （当前是白天，跳过）')
  return out.join('\n')
})()
