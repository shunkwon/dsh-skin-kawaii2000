/*
 * 悬浮打开侧栏 —— 侧栏收起时，鼠标停在左上角的鲸鱼图标上就展开。
 *
 * 那个鲸鱼图标就是应用自己的「打开侧边栏」按钮（⌥⌘B），这里只是替用户点它
 * 一下，走应用自己的点击逻辑。展开后不自动收回：应用的侧栏是挤占式的，
 * 移开就收会让正文每次左右挤一下。关的方式照旧（收起按钮 / ⌥⌘B）。
 *
 * 本文件由 build.mjs 原样内联进 lib/client.js 的 factory，不是 ES 模块，别写 export。
 */
const HOVER_OPEN_DELAY = 150

// 只认收起状态下的按钮：展开后同一个按钮挪到侧栏右上角、变成「收起侧边栏」，
// 那时它已不在 _collapsed 根节点下，悬浮不会把侧栏关掉。
const COLLAPSED_TOGGLE = '.hHd-Xa_collapsed .hHd-Xa_toggle'

/**
 * 在 doc 上挂监听，返回卸载函数。
 * 用 pointermove 而不是 pointerover：按 ⌥⌘B 收起时鼠标若正停在左上角，按钮会
 * 「移到」静止的指针底下，浏览器会补发 over，用 over 就会刚收起又自己弹开。
 */
function installSidebarHover(doc) {
  let timer = 0
  const onMove = (event) => {
    // 触屏点一下会同时触发悬浮和点击，不过滤就会开了又马上关
    if (timer || event.pointerType !== 'mouse') return
    const button = event.target instanceof Element ? event.target.closest(COLLAPSED_TOGGLE) : null
    if (button === null) return
    timer = setTimeout(() => {
      timer = 0
      // 只是路过就不开；这段时间里用户已经自己点开了也不再点，否则开了又关
      if (button.isConnected && button.matches(':hover') && button.matches(COLLAPSED_TOGGLE)) button.click()
    }, HOVER_OPEN_DELAY)
  }
  doc.addEventListener('pointermove', onMove)
  return () => {
    doc.removeEventListener('pointermove', onMove)
    clearTimeout(timer)
    timer = 0
  }
}
