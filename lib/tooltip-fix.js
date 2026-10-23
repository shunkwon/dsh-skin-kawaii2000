/*
 * 玻璃面里的提示气泡归位。
 *
 * primitives 的 Tooltip 是 position: fixed，位置按窗口坐标算（inline left/top）。
 * 可皮肤给侧栏、画布、右栏都加了 backdrop-filter，它让元素成为 fixed 子元素的
 * 包含块，于是气泡的 left/top 变成相对那块面板算：画布里的提示往右偏一整个侧栏宽
 * （展开时 294px，直接出了窗口），收起时也偏 14px，靠右的被画布裁掉半截。菜单不受
 * 影响，它们用的是 CSS 锚点定位。
 *
 * 这里在气泡出现、或者它的 left/top 变了的时候，量出包含块的原点（往气泡旁边塞一个
 * left:0; top:0 的 fixed 探针，读完就删），用 translate 抵回去；面板会裁切内容时，
 * 再把气泡收回面板边缘以内。transform 不碰，那是气泡自己的居中。
 * 侧栏展开时开关的提示由 skin.css 按侧栏坐标直接摆，带 translate: none !important，
 * 这里设的 translate 对它不生效。
 *
 * 本文件由 build.mjs 原样内联进 lib/client.js 的 factory，不是 ES 模块，别写 export。
 */
const TOOLTIP = '[role="tooltip"]'
const TOOLTIP_PANES = '.pI_x6G_sidebarCol, .pI_x6G_centerCol, .pI_x6G_rightbarCol'
// 离面板边缘至少留这么多，免得贴着圆角被切
const TOOLTIP_EDGE = 6

/** fixed 定位元素的包含块原点（窗口坐标）：放一个 left:0; top:0 的探针量一下。 */
function fixedOrigin(tip) {
  const probe = tip.ownerDocument.createElement('span')
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none'
  tip.parentNode.insertBefore(probe, tip)
  const { left, top } = probe.getBoundingClientRect()
  probe.remove()
  return { left, top }
}

/** 某个轴上要再挪多少，才能让 [start, end] 落在 [min, max] 以内；放不下就不挪。 */
function nudgeInto(start, end, min, max) {
  if (end - start > max - min) return 0
  if (end > max) return max - end
  if (start < min) return min - start
  return 0
}

/** 在 doc 上挂监听，返回卸载函数。 */
function installTooltipFix(doc) {
  const view = doc.defaultView
  const handled = new WeakMap()
  const place = (tip) => {
    if (!tip.isConnected || tip.parentNode === null) return
    // 只在气泡自己的位置变了时重算；我们写的 translate 也会触发 style 变动，这样不会自激
    const key = `${tip.style.left}|${tip.style.top}|${tip.style.visibility}`
    if (handled.get(tip) === key) return
    handled.set(tip, key)
    if (view.getComputedStyle(tip).position !== 'fixed') return
    const origin = fixedOrigin(tip)
    let dx = -origin.left
    let dy = -origin.top
    tip.style.translate = dx || dy ? `${dx}px ${dy}px` : ''
    const pane = tip.closest(TOOLTIP_PANES)
    if (pane !== null && view.getComputedStyle(pane).overflow !== 'visible') {
      const p = pane.getBoundingClientRect()
      const b = tip.getBoundingClientRect()
      dx += nudgeInto(b.left, b.right, p.left + TOOLTIP_EDGE, p.right - TOOLTIP_EDGE)
      dy += nudgeInto(b.top, b.bottom, p.top + TOOLTIP_EDGE, p.bottom - TOOLTIP_EDGE)
      tip.style.translate = dx || dy ? `${dx}px ${dy}px` : ''
    }
  }
  const moves = new MutationObserver((records) => {
    for (const record of records) place(record.target)
  })
  const watched = new WeakSet()
  const watch = (tip) => {
    if (watched.has(tip)) return
    watched.add(tip)
    moves.observe(tip, { attributes: true, attributeFilter: ['style'] })
    place(tip)
  }
  const arrivals = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue
        if (node.matches(TOOLTIP)) watch(node)
        else if (node.firstElementChild !== null) node.querySelectorAll(TOOLTIP).forEach(watch)
      }
    }
  })
  arrivals.observe(doc.body, { childList: true, subtree: true })
  doc.querySelectorAll(TOOLTIP).forEach(watch)
  return () => {
    arrivals.disconnect()
    moves.disconnect()
  }
}
