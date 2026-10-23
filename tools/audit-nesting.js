/*
 * 选择器体检 —— 粘到 DevTools 控制台里跑，看皮肤里哪些 [class*=…] 选择器
 * 同一时刻命中了**嵌套**元素。
 *
 * 为什么需要这个：本皮肤大量用 `[class*="_xxx"]` 去挂组件内部的类名（它们的
 * 形式是 `<hash>_<local>`，后缀稳定、前缀是构建哈希）。但这类选择器是按
 * 子串匹配的 —— `[class*="_card"]` 会同时命中 li.card 和它的子节点
 * cardHead / cardMain / cardDesc / cardIcon，于是每一层都被画上圆角描边，
 * 正好从文字中间穿过去。症状看起来像「一条白条盖住了标题」。
 *
 * 判据：一个选择器命中 N 个元素，其中有的元素包含另一个被命中的元素 →
 * 嵌套命中，几乎总是 bug。修法是把范围收窄到具体的一层（例如只认 li.card），
 * 或者用 :not() 排除子节点。
 *
 * 用法：
 *   1. 打开 http://127.0.0.1:3080，切到要检查的页面（插件、设置→内置插件、
 *      对话、首屏都要各跑一次 —— 不同页面挂的组件不一样）；
 *   2. 粘下面整段，回车；
 *   3. 输出为空 = 这一页干净。
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

  const rows = []
  for (const sel of sels) {
    // 伪元素/伪类拿不到元素，先剥掉
    const bare = sel.replace(/::?(before|after|marker|selection|placeholder|-webkit-[\w-]+)/g, '')
    let els
    try { els = [...document.querySelectorAll(bare)] } catch { continue }
    if (!els.length) continue
    const nested = els.filter(el => els.some(other => other !== el && other.contains(el)))
    if (!nested.length) continue
    rows.push({
      sel,
      nested: nested.length,
      hits: els.length,
      sample: nested.slice(0, 3)
        .map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 30))
        .join(' / '),
    })
  }

  rows.sort((a, b) => b.nested - a.nested)
  return rows.length
    ? rows.map(r => `${r.nested}/${r.hits}  ${r.sel}\n      → ${r.sample}`).join('\n')
    : '这一页没有嵌套命中'
})()
