/*
 * 工作区文件面板（⌥⌘P）：常用文件夹置顶 + 记住展开过的文件夹。
 *
 * 大多数会话的工作区是家目录，面板一打开就是两百多项，最前面全是 __pycache__ 和点开头
 * 的隐藏目录，想找的 projects / Documents 埋在中间，每次还得一层层重新点开。
 * dsh 的 ui-sidebar-files 没有排序或置顶的配置，这里补上：
 *
 * - 每一层各自把「常用」的文件夹排到最前（最多 PIN_MAX 个），下面一条发丝线隔开：
 *   手动钉住的（按钉住先后）→ 默认的（父目录是家目录时的 projects / Documents /
 *   Desktop / Downloads）→ 自动的（这一层里展开过 PIN_AUTO_MIN 次以上的，取前 PIN_AUTO_TOP 个）。
 *   手动取消过的（包括默认那几个）不再自动置顶。
 * - 指针停在文件夹行上，右边出一个图钉按钮，点一下钉住 / 取消；钉住的行平时也留一个淡图钉。
 * - 记下哪些文件夹是展开着的；面板重新打开（或换了会话、根目录重新渲染）时按深度依次
 *   点开回来，最多 PIN_RESTORE_MAX 个。
 *
 * 置顶不搬 DOM：行是 React 渲染的，节点顺序动不得。skin.css 把每层 ul 改成 flex 纵列，
 * 这里只给置顶的 li 写 style.order（React 从不管 li 的 style）。图钉按钮只有一个，
 * 悬停到哪行就挪进哪个 li，绝对定位，不碍 React 往 li 里插子层。
 *
 * 状态存在 localStorage（键 PIN_STORE），路径都是绝对路径，不同工作区互不干扰；
 * 读不到（隐私窗口、存储被禁）就只用默认那几个、不记。
 *
 * 本文件由 build.mjs 原样内联进 lib/client.js 的 factory，不是 ES 模块，别写 export。
 * 和别的几个文件共用一个作用域，顶层名字都带 PIN_ / pin 前缀。
 */
const PIN_ROOT = '.k-1LKG_root'
const PIN_LEVEL = '.k-1LKG_level'
const PIN_ITEM = '.k-1LKG_item'
const PIN_ROW = '.k-1LKG_row'
const PIN_STORE = 'kg-files-pin:v1'
const PIN_MAX = 8 // 每层最多置顶这么多个
const PIN_AUTO_MIN = 3 // 展开过这么多次才自动置顶
const PIN_AUTO_TOP = 3 // 每层自动置顶最多这么多个
const PIN_DEFAULTS = ['projects', 'Documents', 'Desktop', 'Downloads'] // 只在家目录那一层
const PIN_RESTORE_MAX = 12 // 重新打开面板时最多点开这么多个
const PIN_RESTORE_WAIT = 1500 // 点开一个之后最多等它的子层这么久
const PIN_TICK = 80

/** 家目录本身（/Users/名字 或 /home/名字）。 */
const pinIsHome = (path) => /^\/(Users|home)\/[^/]+$/.test(path)
const pinParent = (path) => path.slice(0, path.lastIndexOf('/')) || '/'
const pinDepth = (path) => path.split('/').length

function pinLoad(view) {
  try {
    const raw = view.localStorage.getItem(PIN_STORE)
    const data = raw === null ? {} : JSON.parse(raw)
    return {
      opens: data.opens && typeof data.opens === 'object' ? data.opens : {},
      pinned: Array.isArray(data.pinned) ? data.pinned : [],
      unpinned: Array.isArray(data.unpinned) ? data.unpinned : [],
      expanded: Array.isArray(data.expanded) ? data.expanded : [],
    }
  } catch {
    return { opens: {}, pinned: [], unpinned: [], expanded: [] }
  }
}

function pinSave(view, state) {
  try {
    view.localStorage.setItem(PIN_STORE, JSON.stringify(state))
  } catch {}
}

/** 一层里该置顶的文件夹路径，按排好的顺序。 */
function pinRank(state, dirs) {
  const here = new Set(dirs)
  const out = []
  const add = (path) => {
    if (here.has(path) && !out.includes(path) && out.length < PIN_MAX) out.push(path)
  }
  for (const path of state.pinned) add(path)
  const skipped = new Set(state.unpinned)
  const parent = dirs.length === 0 ? '' : pinParent(dirs[0])
  if (pinIsHome(parent)) {
    for (const name of PIN_DEFAULTS) if (!skipped.has(`${parent}/${name}`)) add(`${parent}/${name}`)
  }
  dirs
    .filter((path) => !skipped.has(path) && (state.opens[path] ?? 0) >= PIN_AUTO_MIN)
    .sort((a, b) => state.opens[b] - state.opens[a])
    .slice(0, PIN_AUTO_TOP)
    .forEach(add)
  return out
}

/** 一个 16px 的线条图钉，描边跟字色走。 */
function pinIcon(doc) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = doc.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('aria-hidden', 'true')
  const path = doc.createElementNS(ns, 'path')
  path.setAttribute('d', 'M6 2.25h4M6.75 2.25v4L4.5 9.25h7L9.25 6.25v-4M8 9.25v4.5')
  svg.appendChild(path)
  return svg
}

/** 在 doc 上挂监听，返回卸载函数。 */
function installFilesPin(doc) {
  const view = doc.defaultView
  let state = pinLoad(view)
  let restoring = false // 正在替用户点开上次展开着的，不计次数、不改记录
  const restored = new WeakSet() // 已经恢复过展开的根层

  const commit = () => pinSave(view, state)
  const dirItems = (level) =>
    [...level.children].filter((li) => li.matches(`${PIN_ITEM}[data-files-entry="directory"]`))

  /** 给一层重排：置顶的写 order，其余清掉。 */
  const arrange = (level) => {
    const items = dirItems(level)
    const ranked = pinRank(state, items.map((li) => li.dataset.filesPath))
    const manual = new Set(state.pinned)
    for (const li of level.children) {
      const at = ranked.indexOf(li.dataset.filesPath)
      if (at < 0) {
        if (li.style.order !== '') li.style.order = ''
        delete li.dataset.kgPinned
        delete li.dataset.kgPinEnd
        continue
      }
      li.style.order = String(at - PIN_MAX - 1)
      li.dataset.kgPinned = manual.has(li.dataset.filesPath) ? 'manual' : 'auto'
      if (at === ranked.length - 1) li.dataset.kgPinEnd = ''
      else delete li.dataset.kgPinEnd
    }
  }
  const arrangeAll = () => {
    for (const level of doc.querySelectorAll(`${PIN_ROOT} ${PIN_LEVEL}`)) arrange(level)
  }

  // —— 图钉按钮：只有一个，悬停到哪个文件夹行就挪进哪个 li ——
  const pin = doc.createElement('button')
  pin.type = 'button'
  pin.className = 'kg-files-pin'
  pin.appendChild(pinIcon(doc))
  let pinFor = null
  const placePin = (li) => {
    pinFor = li
    const row = li.querySelector(`:scope > ${PIN_ROW}`)
    if (row === null) return
    const on = li.dataset.kgPinned !== undefined
    pin.setAttribute('aria-label', on ? '取消置顶' : '置顶这个文件夹')
    pin.title = pin.getAttribute('aria-label')
    pin.dataset.on = on ? 'true' : 'false'
    pin.style.top = `${row.offsetTop + (row.offsetHeight - 22) / 2}px`
    if (pin.parentElement !== li) li.appendChild(pin)
  }
  const onOver = (event) => {
    const target = event.target
    if (!(target instanceof view.Element) || target === pin || pin.contains(target)) return
    const row = target.closest(PIN_ROW)
    const li = row?.parentElement
    if (li === null || li === undefined || !li.matches(`${PIN_ROOT} ${PIN_ITEM}[data-files-entry="directory"]`)) return
    if (li !== pinFor || pin.parentElement !== li) placePin(li)
  }
  const onPin = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (pinFor === null) return
    const path = pinFor.dataset.filesPath
    const on = pinFor.dataset.kgPinned !== undefined
    state.pinned = state.pinned.filter((p) => p !== path)
    state.unpinned = state.unpinned.filter((p) => p !== path)
    if (on) state.unpinned.push(path)
    else state.pinned.push(path)
    commit()
    if (pinFor.parentElement !== null) arrange(pinFor.parentElement)
    placePin(pinFor)
  }
  pin.addEventListener('click', onPin)
  doc.addEventListener('pointerover', onOver, true)

  // —— 计数与记住展开：在应用处理点击之前看 aria-expanded 就知道是要展开还是收起 ——
  const onClick = (event) => {
    if (restoring || !(event.target instanceof view.Element)) return
    const row = event.target.closest(PIN_ROW)
    const li = row?.parentElement
    if (li === null || li === undefined || !li.matches(`${PIN_ROOT} ${PIN_ITEM}[data-files-entry="directory"]`)) return
    const path = li.dataset.filesPath
    const opening = row.getAttribute('aria-expanded') !== 'true'
    state.expanded = state.expanded.filter((p) => p !== path && !(!opening && p.startsWith(`${path}/`)))
    if (opening) {
      state.opens[path] = (state.opens[path] ?? 0) + 1
      state.expanded.push(path)
    }
    commit()
  }
  doc.addEventListener('click', onClick, true)

  /** 面板根层新出现：按深度从浅到深点开上次展开着的。 */
  const restore = (rootLevel) => {
    if (restored.has(rootLevel)) return
    restored.add(rootLevel)
    const panel = rootLevel.closest(PIN_ROOT)
    const queue = [...state.expanded].sort((a, b) => pinDepth(a) - pinDepth(b)).slice(0, PIN_RESTORE_MAX)
    const next = () => {
      if (!rootLevel.isConnected || queue.length === 0) return
      const path = queue.shift()
      const li = [...panel.querySelectorAll(`${PIN_ITEM}[data-files-entry="directory"]`)].find((el) => el.dataset.filesPath === path)
      const row = li?.querySelector(`:scope > ${PIN_ROW}`)
      if (row === null || row === undefined || row.getAttribute('aria-expanded') === 'true') {
        next()
        return
      }
      restoring = true
      row.click()
      restoring = false
      const began = Date.now()
      const wait = () => {
        if (li.querySelector(`:scope > ${PIN_LEVEL}`) !== null || Date.now() - began > PIN_RESTORE_WAIT) next()
        else view.setTimeout(wait, PIN_TICK)
      }
      view.setTimeout(wait, PIN_TICK)
    }
    next()
  }

  // 只理会面板里的变动；正文流式输出时这里也会被叫，先用 closest 筛掉
  const mutations = new MutationObserver((records) => {
    const levels = new Set()
    for (const record of records) {
      const target = record.target
      if (!(target instanceof view.Element)) continue
      if (target.matches(PIN_LEVEL) && target.closest(PIN_ROOT) !== null) levels.add(target)
      for (const node of record.addedNodes) {
        if (!(node instanceof view.Element)) continue
        if (node.matches(PIN_LEVEL) || node.matches(PIN_ROOT) || node.querySelector(PIN_LEVEL) !== null) {
          const inside = node.closest(PIN_ROOT) ?? node.querySelector(PIN_ROOT)
          if (inside === null) continue
          if (node.matches(PIN_LEVEL)) levels.add(node)
          for (const level of node.querySelectorAll(PIN_LEVEL)) levels.add(level)
        }
      }
    }
    for (const level of levels) {
      arrange(level)
      if (level.parentElement?.matches('[data-files-body]')) restore(level)
    }
  })
  mutations.observe(doc.body, { childList: true, subtree: true })
  arrangeAll()
  for (const level of doc.querySelectorAll(`${PIN_ROOT} [data-files-body] > ${PIN_LEVEL}`)) restore(level)

  // 别的窗口 / 标签页改了记录，跟着重排
  const onStorage = (event) => {
    if (event.key !== PIN_STORE) return
    state = pinLoad(view)
    arrangeAll()
  }
  view.addEventListener('storage', onStorage)

  return () => {
    mutations.disconnect()
    doc.removeEventListener('pointerover', onOver, true)
    doc.removeEventListener('click', onClick, true)
    view.removeEventListener('storage', onStorage)
    pin.remove()
    for (const li of doc.querySelectorAll(`${PIN_ROOT} ${PIN_ITEM}`)) {
      li.style.order = ''
      delete li.dataset.kgPinned
      delete li.dataset.kgPinEnd
    }
  }
}
