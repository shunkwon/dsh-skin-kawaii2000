/*
 * 边缘呼出侧栏 —— 顶栏布局下左上角不放侧栏开关。
 *
 * 指针碰到窗口左边缘，侧栏就以一块浮起的玻璃卡片从左边滑出，盖在正文上面、正文
 * 不挪位；指针离开就收回。浮出时按 ⌥⌘B（读开关上的 aria-keyshortcuts，改过
 * 绑定也认）= 钉住：正文让开，侧栏常驻；钉住后再按就是应用自己的收起。
 *
 * 浮出就是替用户点一下（藏起来的）开关，让应用自己展开，同时给 html 打上
 * data-kg-peek；skin.css 用画布的负 margin 把侧栏那一列盖回去，正文的盒子不变。
 * 列宽和 margin 走同一条过渡曲线，滑出、收回时正文纹丝不动。收回是再点一次开关，
 * 等收起动画走完才摘掉 data-kg-peek。
 *
 * 只认鼠标：触屏没有悬停，那里开关照常显示（skin.css 只在 hover + 精确指针时
 * 藏开关），这里也不接管。
 *
 * 本文件由 build.mjs 原样内联进 lib/client.js 的 factory，不是 ES 模块，别写 export。
 */
const PEEK_EDGE = 8 // 左边缘热区（px）。窗口贴边后这一条就压在正文左缘上，所以窄一点
const PEEK_HINT = 56 // 离左边缘这么近时亮出边缘提示条
const PEEK_OPEN_DELAY = 120 // 在热区里停这么久才浮出，路过不算
const PEEK_CLOSE_DELAY = 280 // 离开侧栏这么久才收回
const PEEK_SLACK = 24 // 侧栏右缘再往右这么宽都还算「在侧栏上」
const PEEK_FRAME = '.pI_x6G_frame'
const PEEK_SIDEBAR = '.pI_x6G_sidebarCol'
const PEEK_TOGGLE = '.hHd-Xa_toggle'
// 这些开着的时候不收回：多半是从侧栏里打开的（会话菜单、设置菜单、视图选项）
const PEEK_HOLDERS = '[role="menu"], [role="listbox"], [role="dialog"]'

/** 按键是否就是开关的快捷键。spec 形如 "Alt+Meta+B"，可能空格分隔多组。 */
function matchesShortcut(event, spec) {
  return spec.split(/\s+/).filter(Boolean).some((combo) => {
    const parts = combo.split('+')
    const key = parts.pop()
    const mods = new Set(parts.map((part) => part.toLowerCase()))
    if (event.altKey !== mods.has('alt') || event.metaKey !== mods.has('meta')) return false
    if (event.ctrlKey !== (mods.has('control') || mods.has('ctrl')) || event.shiftKey !== mods.has('shift')) return false
    // ⌥ 会把 event.key 变成别的字符（⌥B = ∫），字母和数字按物理键位认
    if (/^[a-z]$/i.test(key)) return event.code === `Key${key.toUpperCase()}`
    if (/^[0-9]$/.test(key)) return event.code === `Digit${key}`
    return event.key.toLowerCase() === key.toLowerCase()
  })
}

/** 在 doc 上挂监听，返回卸载函数。 */
function installSidebarPeek(doc) {
  const root = doc.documentElement
  const view = doc.defaultView
  const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)')
  let openTimer = 0
  let closeTimer = 0
  let lastX = Infinity
  let inWindow = true

  const frame = () => doc.querySelector(PEEK_FRAME)
  const collapsed = () => frame()?.hasAttribute('data-sidebar-collapsed') ?? true
  const peeking = () => root.hasAttribute('data-kg-peek')
  const active = () => root.hasAttribute('data-kg-topbar') && finePointer.matches
  const shown = (selector) => [...doc.querySelectorAll(selector)].some((el) => el.getClientRects().length > 0)
  const typingInSidebar = () => {
    const focus = doc.activeElement
    return focus !== null && focus.closest(PEEK_SIDEBAR) !== null && focus.matches('input, textarea, [contenteditable="true"]')
  }
  const overSidebar = () => {
    const side = doc.querySelector(PEEK_SIDEBAR)?.getBoundingClientRect()
    return inWindow && side !== undefined && lastX <= side.right + PEEK_SLACK
  }
  const stopTimers = () => {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    openTimer = 0
    closeTimer = 0
  }
  const setHint = (on) => {
    if (on) root.setAttribute('data-kg-edge', '')
    else root.removeAttribute('data-kg-edge')
  }

  const open = () => {
    const toggle = doc.querySelector(PEEK_TOGGLE)
    if (toggle === null || !collapsed() || peeking() || shown('[role="dialog"]')) return
    setHint(false)
    root.setAttribute('data-kg-peek', '')
    toggle.click()
  }
  const tryClose = () => {
    closeTimer = 0
    if (!peeking() || collapsed() || overSidebar()) return
    if (shown(PEEK_HOLDERS) || typingInSidebar()) {
      closeTimer = setTimeout(tryClose, PEEK_CLOSE_DELAY)
      return
    }
    doc.querySelector(PEEK_TOGGLE)?.click()
  }
  const scheduleClose = () => {
    if (!closeTimer) closeTimer = setTimeout(tryClose, PEEK_CLOSE_DELAY)
  }

  const onMove = (event) => {
    if (event.pointerType !== 'mouse' || !active()) return
    lastX = event.clientX
    inWindow = true
    if (collapsed() && !peeking()) {
      setHint(lastX < PEEK_HINT && event.buttons === 0)
      // 按着键（比如从左边开始框选文字）时不浮出
      if (lastX >= PEEK_EDGE || event.buttons !== 0) {
        clearTimeout(openTimer)
        openTimer = 0
      } else if (!openTimer) {
        openTimer = setTimeout(() => {
          openTimer = 0
          if (inWindow && lastX < PEEK_EDGE) open()
        }, PEEK_OPEN_DELAY)
      }
      return
    }
    if (!peeking()) return
    // 按着键在拖（比如拖宽侧栏）时不收
    if (event.buttons !== 0 || overSidebar()) {
      clearTimeout(closeTimer)
      closeTimer = 0
    } else {
      scheduleClose()
    }
  }
  const onOut = (event) => {
    if (event.relatedTarget !== null) return
    inWindow = false
    setHint(false)
    clearTimeout(openTimer)
    openTimer = 0
    if (peeking()) scheduleClose()
  }
  const onKey = (event) => {
    if (!peeking() || collapsed()) return
    const spec = doc.querySelector(PEEK_TOGGLE)?.getAttribute('aria-keyshortcuts')
    if (!spec || !matchesShortcut(event, spec)) return
    // 浮出时的快捷键 = 钉住；拦下来，别让应用把侧栏收起
    event.preventDefault()
    event.stopImmediatePropagation()
    stopTimers()
    root.removeAttribute('data-kg-peek')
  }
  // 收起动画走完再摘 data-kg-peek，否则正文会先被推一下；应用因为别的原因收起时
  // （打开右栏、窗口变窄）也走这里
  const settle = () => {
    const f = frame()
    if (f === null || !peeking()) return
    if (f.hasAttribute('data-sidebar-collapsed') && !f.hasAttribute('data-animating')) {
      root.removeAttribute('data-kg-peek')
      stopTimers()
    }
  }
  const frameWatch = new view.MutationObserver(settle)
  frameWatch.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['data-sidebar-collapsed', 'data-animating'] })

  doc.addEventListener('pointermove', onMove)
  doc.addEventListener('pointerout', onOut)
  view.addEventListener('keydown', onKey, true)
  return () => {
    frameWatch.disconnect()
    doc.removeEventListener('pointermove', onMove)
    doc.removeEventListener('pointerout', onOut)
    view.removeEventListener('keydown', onKey, true)
    stopTimers()
    setHint(false)
    root.removeAttribute('data-kg-peek')
  }
}
