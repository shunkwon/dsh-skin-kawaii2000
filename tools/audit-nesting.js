/*
 * 选择器体检 —— 粘到 DevTools 控制台里跑。
 *
 * 本皮肤大量用 `[class*=…]` 挂组件内部类名（形式是 `<hash>_<local>`，后缀稳定、
 * 前缀是构建哈希）。子串匹配有两类必然会踩的坑，这个脚本各查一遍：
 *
 *   A. 嵌套命中：一个选择器同时命中父子两层。
 *      `[class*="_card"]` 会命中 li.card 以及它的子节点 cardHead / cardMain /
 *      cardDesc / cardIcon，于是每一层都套上圆角描边，正好从文字中间穿过去 ——
 *      症状是「一条圆角白条盖住了标题」。
 *
 *   B. 跨组件命中：一个选择器命中了不同组件的同名后缀。
 *      `[class*="_pill"]` 本意是底部状态药丸，却同时命中了插件页
 *      「已安装 / 发现」那对分段页签（它们的类名也带 _pill），把页签改成
 *      999px 药丸 + 亮边，和 tablist 的凹槽叠成两层框。
 *
 * 判据 A：命中的元素之间存在祖先/后代关系 → 嵌套。
 * 判据 B：命中元素的类名哈希前缀不止一种 → 跨组件。
 *
 * 修法：收窄到某一层（例如只认 li.card）、只用某个组件的类名前缀
 * （例如 bOPqQW_pill）、或者用 :not() 排除子节点。
 *
 * 用法：
 *   1. 打开 http://127.0.0.1:3080，切到要检查的页面；
 *   2. 粘下面整段，回车；
 *   3. 对照输出逐条判断 —— 有些是故意的（如 `…tools button` 命中工具条里
 *      不同组件的按钮），看到就核对一下是不是预期。
 *   4. 插件页、设置→内置插件、对话、首屏各跑一次（挂的组件不一样）。
 */

(() => {
  const tag = [...document.querySelectorAll('style[data-plugin-css]')]
    .find(t => /kawaii2000/.test(t.dataset.pluginCss))
  if (!tag) return '没找到皮肤的 style 标签'

  const sels = new Set()
  for (const m of tag.textContent.matchAll(/([^{}]+)\{/g)) {
    for (const part of m[1].split(',')) {
      const s = part.trim()
      if (s && s.includes('class*=')) sels.add(s)
    }
  }

  const hashOf = (cls) => {
    const m = /^([A-Za-z0-9_-]+?)_/.exec(cls)
    return m ? m[1] : cls
  }

  const nestedRows = []
  const crossRows = []

  for (const sel of sels) {
    // 伪元素/伪类拿不到元素，先剥掉
    const bare = sel.replace(/::?(before|after|marker|selection|placeholder|-webkit-[\w-]+)/g, '')
    let els
    try { els = [...document.querySelectorAll(bare)] } catch { continue }
    if (!els.length) continue

    const nested = els.filter(el => els.some(other => other !== el && other.contains(el)))
    if (nested.length) {
      nestedRows.push(`${nested.length}/${els.length}  ${sel}\n      → ` + nested.slice(0, 3)
        .map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 30)).join(' / '))
    }

    const groups = new Map()
    for (const el of els) {
      const cls = (el.className || '').toString()
      if (!cls) continue
      const h = hashOf(cls.split(/\s+/)[0])
      groups.set(h, (groups.get(h) || 0) + 1)
    }
    if (groups.size > 1) {
      crossRows.push(`${sel}\n      → ` + [...groups].map(([h, n]) => h + '×' + n).join(', '))
    }
  }

  const out = []
  out.push('== A. 嵌套命中 ==')
  out.push(nestedRows.length ? nestedRows.join('\n') : '  无')
  out.push('')
  out.push('== B. 跨组件命中 ==')
  out.push(crossRows.length ? crossRows.join('\n') : '  无')
  return out.join('\n')
})()
