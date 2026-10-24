/*
 * 侧栏的浮出、钉住、收起 —— 顶栏布局下左上角不放侧栏开关。
 *
 * 动起来的只有侧栏自己的 transform；正文要么不变，要么等侧栏停下来才一次让开或
 * 铺满。以前是侧栏列宽、画布的负 margin、卡片的留边 / 圆角 / 投影一起过渡，整段
 * 对话每一帧都要重排、磨砂每一帧都要重画，长对话里明显掉帧。画布宽度变一次在
 * WebKit 里要 60~90ms（长对话），这一下省不掉，只能挪到没东西在动的时候。
 *
 * 状态写在 <html data-kg-side="…">，几个词用空格隔开，skin.css 只认这几个词：
 *   overlay  画布横跨侧栏那一列，盒子不变；侧栏压在正文上面
 *   card     浮出的样子：离窗口边 8px 的圆角玻璃卡片
 *   hidden   侧栏摆到窗口左边外面，不带过渡（摆好滑进来的起点）
 *   leaving  侧栏滑到窗口左边外面，带过渡
 *
 * - 浮出：指针碰到窗口左边缘停一下 → overlay card hidden，替用户切换侧栏（按应用
 *   自己的快捷键，见 pressToggle），应用把侧栏展开成一列；画出一帧后摘掉 hidden，
 *   侧栏滑进来。正文从头到尾不重排。
 * - 收回：指针离开侧栏 → leaving，滑走之后再让应用收起，收起后清掉 data-kg-side。
 *   滑走途中指针回到侧栏上，就原路滑回来。
 * - 钉住：浮出时按 ⌥⌘B → 清掉 data-kg-side，画布回到自己那一列，正文让开（只这
 *   一次重排，侧栏不动）。读开关上的 aria-keyshortcuts，改过绑定也认。
 * - 钉住时按 ⌥⌘B（或在触屏上点开关）→ 侧栏立刻原地滑走；停下后先 overlay 让正文
 *   铺满，下一帧再让应用收起。按键马上有反应，重排落在动画之后。
 * - 别的途径展开（收起时按 ⌥⌘B、命令面板）：应用照常展开、正文一次让开；这里在
 *   第一帧画出来之前把侧栏摆到窗口外，再滑进空出来的那一条。
 * 布局自己的列宽过渡在 skin.css 里关掉了，列宽展开、收起都是一步到位。
 *
 * 指针浮出只认鼠标：触屏没有悬停，那里开关照常显示（skin.css 只在 hover + 精确
 * 指针时藏开关）。
 *
 * 本文件由 build.mjs 原样内联进 lib/client.js 的 factory，不是 ES 模块，别写 export。
 */
const SIDE_ATTR = 'data-kg-side'
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
  // idle：没在动（收起或钉住）；in：浮出中；out：正在滑走、还没收起
  let phase = 'idle'
  let card = false // 这一轮是边缘浮出（卡片），不是钉住的侧栏
  let run = 0 // 每次换状态加一，等待中的旧步骤看到对不上就作废
  let own = false // 正在替用户点开关，别拦自己
  let openTimer = 0
  let closeTimer = 0
  let lastX = Infinity
  let inWindow = true
  let hint = false
  let edge = null // 浮出时侧栏右缘的窗口坐标（不含 transform），每次浮出量一次

  const frame = () => doc.querySelector(PEEK_FRAME)
  const column = () => doc.querySelector(PEEK_SIDEBAR)
  const collapsed = () => frame()?.hasAttribute('data-sidebar-collapsed') ?? true
  const active = () => root.hasAttribute('data-kg-topbar') && finePointer.matches
  const shown = (selector) => [...doc.querySelectorAll(selector)].some((el) => el.getClientRects().length > 0)
  const typingInSidebar = () => {
    const focus = doc.activeElement
    return focus !== null && focus.closest(PEEK_SIDEBAR) !== null && focus.matches('input, textarea, [contenteditable="true"]')
  }
  const setSide = (...words) => {
    const value = words.filter(Boolean).join(' ')
    if (value === (root.getAttribute(SIDE_ATTR) ?? '')) return
    if (value) root.setAttribute(SIDE_ATTR, value)
    else root.removeAttribute(SIDE_ATTR)
  }
  const setHint = (on) => {
    if (on === hint) return
    hint = on
    if (on) root.setAttribute('data-kg-edge', '')
    else root.removeAttribute('data-kg-edge')
  }
  // 替用户切换侧栏。先按应用自己的快捷键：长对话里（WebKit 实测）按快捷键收起是
  // 一帧 60ms，点开关是两帧、各 75~90ms。快捷键认不出来、或者按了 200ms 没反应
  // （比如被别的东西拦了），再点开关
  const pressToggle = () => {
    const toggle = doc.querySelector(PEEK_TOGGLE)
    const parts = (toggle?.getAttribute('aria-keyshortcuts') ?? '').split(/\s+/).find(Boolean)?.split('+') ?? []
    const key = parts.pop() ?? ''
    const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : null
    if (code === null) return false
    const mods = new Set(parts.map((part) => part.toLowerCase()))
    own = true
    try {
      ;(doc.activeElement ?? doc.body).dispatchEvent(new view.KeyboardEvent('keydown', {
        code,
        key: key.toLowerCase(),
        altKey: mods.has('alt'),
        metaKey: mods.has('meta'),
        ctrlKey: mods.has('control') || mods.has('ctrl'),
        shiftKey: mods.has('shift'),
        bubbles: true,
        cancelable: true,
      }))
    } finally {
      own = false
    }
    return true
  }
  const clickToggle = () => {
    own = true
    try { doc.querySelector(PEEK_TOGGLE)?.click() } finally { own = false }
  }
  /** 让应用展开（wantCollapsed = false）或收起，等它真的变了；返回是否成功。 */
  const switchTo = async (wantCollapsed) => {
    if (pressToggle() && (await settled(wantCollapsed, 200))) return true
    if (collapsed() === wantCollapsed) return true
    clickToggle()
    return settled(wantCollapsed, 1500)
  }
  // 等这一帧画出来（隐藏的页面不出帧，最多等 120ms）
  const painted = () => new Promise((resolve) => {
    const timer = view.setTimeout(resolve, 120)
    view.requestAnimationFrame(() => view.requestAnimationFrame(() => { view.clearTimeout(timer); resolve() }))
  })
  // 等应用真的展开 / 收起：它不是同步改的（实测晚 25~60ms）。点开关后最多等 1.5 秒，
  // 窗口在后台时计时器会被压到 1 秒一次
  const settled = (wantCollapsed, ms) => new Promise((resolve) => {
    const start = view.performance.now()
    const check = () => {
      if (collapsed() === wantCollapsed) resolve(true)
      else if (view.performance.now() - start > ms) resolve(false)
      else view.setTimeout(check, 16)
    }
    check()
  })
  // 等侧栏的 transform 过渡走完；没有过渡（减少动效）就不等
  const slid = () => new Promise((resolve) => {
    const el = column()
    const seconds = el === null ? 0 : Math.max(0, ...view.getComputedStyle(el).transitionDuration.split(',').map(parseFloat))
    if (!(seconds > 0)) return resolve()
    const done = () => { el.removeEventListener('transitionend', onEnd); view.clearTimeout(timer); resolve() }
    const onEnd = (event) => { if (event.target === el && event.propertyName === 'transform') done() }
    el.addEventListener('transitionend', onEnd)
    const timer = view.setTimeout(done, seconds * 1000 + 100)
  })
  const sidebarRight = () => {
    if (edge === null) {
      const el = column()
      if (el === null) return -Infinity
      edge = (frame()?.getBoundingClientRect().left ?? 0) + el.offsetLeft + el.offsetWidth
    }
    return edge
  }
  const stopTimers = () => {
    view.clearTimeout(openTimer)
    view.clearTimeout(closeTimer)
    openTimer = 0
    closeTimer = 0
  }

  /** 滑进来。浮出（card）时 overlay 让正文原地不动、一直盖着；钉住的侧栏不盖：
      正文在侧栏还在窗口外时就一次让开，侧栏再滑进空出来的那一条。应用还收着就替
      用户切换。 */
  const slideIn = async (asCard) => {
    const mine = ++run
    stopTimers()
    phase = 'in'
    card = asCard
    edge = null
    setHint(false)
    setSide(card && 'overlay', card && 'card', 'hidden')
    if (collapsed()) {
      const opened = await switchTo(false)
      if (mine !== run) return
      // 应用没展开（比如开关不在了）：别把侧栏晾在窗口外
      if (!opened) {
        run++
        phase = 'idle'
        card = false
        setSide()
        return
      }
    }
    await painted()
    if (mine !== run) return
    setSide(card && 'overlay', card && 'card')
    if (card) return
    await slid()
    if (mine === run) phase = 'idle'
  }
  /** 滑走，停下后再让应用收起（收起后由 watch 清掉 data-kg-side）。浮出的卡片一直
      盖着正文；钉住的侧栏原地滑走，停下后先 overlay 让正文铺满，下一帧再让应用收起：
      正文重排和应用重画侧栏分在两帧，空出来的那一条补得更快。 */
  const slideOut = async () => {
    if (collapsed()) return
    const mine = ++run
    stopTimers()
    phase = 'out'
    setSide(card && 'overlay', card && 'card', 'leaving')
    await slid()
    if (mine !== run) return
    setSide('overlay', card && 'card', 'hidden')
    if (!card) {
      await painted()
      if (mine !== run) return
    }
    const closed = await switchTo(true)
    // 应用没收起：原路滑回来（收起了的话 watch 已经清过场，run 对不上）
    if (mine === run && !closed) comeBack()
  }
  /** 浮出时钉住：摘掉 overlay，正文让开（只这一次重排），侧栏原地留下。 */
  const pin = () => {
    run++
    stopTimers()
    phase = 'idle'
    card = false
    setSide()
  }
  /** 正在滑走时反悔：原路滑回来。 */
  const comeBack = () => {
    run++
    stopTimers()
    phase = card ? 'in' : 'idle'
    setSide(card && 'overlay', card && 'card')
  }

  const tryClose = () => {
    closeTimer = 0
    if (phase !== 'in' || !card) return
    if (inWindow && lastX <= sidebarRight() + PEEK_SLACK) return
    if (shown(PEEK_HOLDERS) || typingInSidebar()) {
      closeTimer = view.setTimeout(tryClose, PEEK_CLOSE_DELAY)
      return
    }
    slideOut()
  }
  const scheduleClose = () => {
    if (!closeTimer) closeTimer = view.setTimeout(tryClose, PEEK_CLOSE_DELAY)
  }

  const onMove = (event) => {
    if (event.pointerType !== 'mouse' || !active()) return
    lastX = event.clientX
    inWindow = true
    if (phase === 'idle') {
      if (!collapsed()) return
      setHint(lastX < PEEK_HINT && event.buttons === 0)
      // 按着键（比如从左边开始框选文字）时不浮出
      if (lastX >= PEEK_EDGE || event.buttons !== 0) {
        view.clearTimeout(openTimer)
        openTimer = 0
      } else if (!openTimer) {
        openTimer = view.setTimeout(() => {
          openTimer = 0
          if (inWindow && lastX < PEEK_EDGE && collapsed() && !shown('[role="dialog"]')) slideIn(true)
        }, PEEK_OPEN_DELAY)
      }
      return
    }
    if (!card) return
    if (phase === 'out') {
      if (event.buttons === 0 && lastX <= sidebarRight()) comeBack()
      return
    }
    // 按着键在拖（比如拖宽侧栏）时不收；拖完右缘可能变了，下次重新量
    if (event.buttons !== 0) edge = null
    if (event.buttons !== 0 || lastX <= sidebarRight() + PEEK_SLACK) {
      view.clearTimeout(closeTimer)
      closeTimer = 0
    } else {
      scheduleClose()
    }
  }
  const onOut = (event) => {
    if (event.relatedTarget !== null) return
    inWindow = false
    setHint(false)
    view.clearTimeout(openTimer)
    openTimer = 0
    if (phase === 'in' && card) scheduleClose()
  }
  /** ⌥⌘B 或点开关时该做什么：浮出时是钉住，正在滑走时是滑回来，其余是滑走收起。 */
  const toggleAction = () => {
    if (phase === 'out') comeBack()
    else if (phase === 'in' && card) pin()
    else slideOut()
  }
  const onKey = (event) => {
    if (own) return // 自己替用户按的
    const spec = doc.querySelector(PEEK_TOGGLE)?.getAttribute('aria-keyshortcuts')
    if (!spec || !matchesShortcut(event, spec)) return
    // 收起时交给应用展开，watch 让侧栏滑进来；有对话框开着时也交给应用自己决定
    if ((phase === 'idle' && collapsed()) || shown('[role="dialog"]')) return
    event.preventDefault()
    event.stopImmediatePropagation()
    toggleAction()
  }
  // 触屏上点开关：同样先滑走再收
  const onClick = (event) => {
    if (own || (phase === 'idle' && collapsed())) return
    if (!(event.target instanceof view.Element) || event.target.closest(PEEK_TOGGLE) === null) return
    event.preventDefault()
    event.stopImmediatePropagation()
    toggleAction()
  }
  // 应用收起了（不管谁让的）就清场。别的途径展开的（收起时按 ⌥⌘B、命令面板）：
  // 这里在第一帧画出来之前就把侧栏摆到窗口外、让正文原地不动，再按钉住的侧栏滑进来
  // 只在 data-sidebar-collapsed 真的变了时触发，所以每次回调都是一次展开或收起；
  // 不缓存上一次的状态（皮肤可能比布局先装上，那时连 frame 都还没有）
  const watch = new view.MutationObserver(() => {
    if (collapsed()) {
      run++
      stopTimers()
      phase = 'idle'
      card = false
      setSide()
    } else if (phase === 'idle') {
      slideIn(false)
    }
  })
  watch.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['data-sidebar-collapsed'] })

  view.addEventListener('pointermove', onMove, { capture: true, passive: true })
  doc.addEventListener('pointerout', onOut)
  view.addEventListener('keydown', onKey, true)
  view.addEventListener('click', onClick, true)
  return () => {
    watch.disconnect()
    view.removeEventListener('pointermove', onMove, { capture: true })
    doc.removeEventListener('pointerout', onOut)
    view.removeEventListener('keydown', onKey, true)
    view.removeEventListener('click', onClick, true)
    run++
    stopTimers()
    setHint(false)
    setSide()
  }
}
