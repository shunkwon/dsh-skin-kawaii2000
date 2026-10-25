/*
 * 搜索结果点进去：滚到关键词所在处并高亮。
 *
 * 侧栏搜索能搜到消息正文（全文索引在 profile 补丁里打开），但应用点一条结果只打开
 * 会话、停在底部 —— ui-workspace 的 SearchResultItem 注释写明「opens the session
 * only; it does not address an event」，也没有配置项。这里替它补上后半截：
 *
 * - 点结果行时（capture 阶段，先于应用自己的 onClick）记下搜索框里的词、这一行的标题
 *   和摘录。
 * - 等 document.title 换成这个会话的标题、正文渲染出来，在对话滚动区里找这个词。
 *   正文不虚拟化（useVirtualizer 只用于右侧轮次导航条），已加载的轮次都在 DOM 里；
 *   找不到就点「加载更早」往前翻，最多 JUMP_MAX_LOADS 次。
 * - 出现好几处时，用摘录里关键词前后的字去比，挑重合最多的那处 —— 摘录就是后端选出的
 *   最佳匹配；都对不上取第一处。
 * - 一轮里最终回答之前的步骤会被折叠成 hidden="until-found"：字在 DOM 里但看不见。
 *   命中在这种折叠里时，先给它发 beforematch（浏览器页内查找也是这么展开它的），
 *   应用展开后再滚过去。根本没渲染出来的内容（比如没点开的工具输出）找不到就算了。
 * - 高亮用 CSS Custom Highlight API（CSS.highlights），不改 DOM，不会和 React 打架：
 *   kg-find 是所有出现处（含侧栏结果的标题和摘录），kg-find-current 是滚过去的那处。
 *   颜色在 skin.css 的令牌层（--kg-find / --kg-find-current）和第 8 节。
 * - 切到别的会话（title 变了）或下一次跳转时清掉对话里的高亮；侧栏的跟着搜索框走。
 *
 * 本文件由 build.mjs 原样内联进 lib/client.js 的 factory，不是 ES 模块，别写 export。
 * 和别的几个文件共用一个作用域，顶层名字都带 JUMP_ / jump 前缀。
 */
const JUMP_INPUT = '.bhn1Oq_searchInput'
const JUMP_ROW = '.YDXeBa_searchResultRow'
const JUMP_ROW_TITLE = '.YDXeBa_searchResultTitle'
const JUMP_ROW_SNIPPET = '.YDXeBa_searchResultSnippet'
const JUMP_SCROLL = '.wSkVaW_scrollBody'
const JUMP_COMPOSER = '.wSkVaW_composerSeat'
const JUMP_OLDER = '.EvIC1a_older button'
const JUMP_TICK = 150 // 每隔这么久看一次正文
const JUMP_DEADLINE = 10000 // 从点下去算，最多找这么久
const JUMP_TITLE_WAIT = 2000 // 等 title 换过来最多这么久，过了就当已经打开（未命名会话的 title 对不上）
const JUMP_SETTLE = 900 // 正文这么久没变才算渲染完，再决定要不要往前翻
const JUMP_MAX_LOADS = 10 // 最多点这么多次「加载更早」
const JUMP_CONTEXT = 24 // 摘录里关键词前后各取这么多字用来挑位置
const JUMP_HOLD = 3000 // 跳过去之后守住位置这么久，免得应用又把视图贴回底部
const JUMP_REVEAL_WAIT = 1500 // 等折叠块展开最多这么久
const JUMP_REVEAL_SETTLE = 350 // 展开后再等这么久（展开动画）才滚

/** 搜索词 → 大小写不敏感、空白宽松的正则；空词返回 null。 */
function jumpPattern(query) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  return new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'gi')
}

/** root 下的文本拼成一串，记下每个文本节点的起点，好把串里的位置换回 Range。 */
function jumpCollect(root, skip) {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (skip !== null && skip.contains(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes = []
  const starts = []
  let text = ''
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    nodes.push(node)
    starts.push(text.length)
    text += node.data
  }
  return { doc, nodes, starts, text }
}

/** 串里的位置 → [文本节点, 节点内偏移]。end 为真时落在前一个节点的末尾，免得 Range 多包一个空节点。 */
function jumpLocate(collected, index, end) {
  const { nodes, starts } = collected
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (end ? starts[mid] < index : starts[mid] <= index) lo = mid
    else hi = mid - 1
  }
  return [nodes[lo], index - starts[lo]]
}

/** 找出所有出现处，返回 { range, start, end }。 */
function jumpMatches(collected, pattern) {
  const found = []
  if (pattern === null || collected.nodes.length === 0) return found
  pattern.lastIndex = 0
  for (let m = pattern.exec(collected.text); m !== null; m = pattern.exec(collected.text)) {
    if (m[0].length === 0) {
      pattern.lastIndex += 1
      continue
    }
    const start = m.index
    const end = start + m[0].length
    const range = collected.doc.createRange()
    range.setStart(...jumpLocate(collected, start, false))
    range.setEnd(...jumpLocate(collected, end, true))
    found.push({ range, start, end })
  }
  return found
}

const jumpSquash = (s) => s.replace(/\s+/g, ' ').toLowerCase()

/** a 的末尾和 b 的末尾有多少个字相同。 */
function jumpCommonTail(a, b) {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

/** a 的开头和 b 的开头有多少个字相同。 */
function jumpCommonHead(a, b) {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/** range 外面一层层折叠起来的块（hidden="until-found"），从外到里，到 root 为止。 */
function jumpFolds(range, root) {
  const folds = []
  for (let el = range.startContainer.parentElement; el !== null && el !== root; el = el.parentElement) {
    if (el.getAttribute('hidden') === 'until-found') folds.unshift(el)
  }
  return folds
}

/**
 * 用摘录挑出最像后端那处最佳匹配的一处。display:none 里的（没有排版盒子）不算；
 * 折叠块里的算，跳过去前会先展开。分数一样时挑不用展开的。
 */
function jumpPick(collected, matches, pattern, snippet, root) {
  const visible = matches.filter((m) => m.range.getClientRects().length > 0)
  if (visible.length === 0) return null
  const clean = snippet.replace(/…|\.\.\./g, ' ')
  pattern.lastIndex = 0
  const s = pattern.exec(clean)
  const before = s === null ? '' : jumpSquash(clean.slice(Math.max(0, s.index - JUMP_CONTEXT), s.index))
  const after = s === null ? '' : jumpSquash(clean.slice(s.index + s[0].length, s.index + s[0].length + JUMP_CONTEXT))
  let best = null
  let bestScore = -1
  for (const m of visible) {
    const hb = jumpSquash(collected.text.slice(Math.max(0, m.start - JUMP_CONTEXT * 3), m.start))
    const ha = jumpSquash(collected.text.slice(m.end, m.end + JUMP_CONTEXT * 3))
    // 匹配上的字数 ×2，再给不在折叠里的加 1：只用来破平局
    const score = (jumpCommonTail(before, hb) + jumpCommonHead(after, ha)) * 2 + (jumpFolds(m.range, root).length === 0 ? 1 : 0)
    if (score > bestScore) {
      best = m
      bestScore = score
    }
  }
  return best
}

/** 在 doc 上挂监听，返回卸载函数。 */
function installSearchJump(doc) {
  const view = doc.defaultView
  const registry = view.CSS !== undefined && 'highlights' in view.CSS ? view.CSS.highlights : null
  const Highlight = view.Highlight
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)')
  let chatRanges = []
  let listRanges = []
  let job = 0 // 每次跳转加一，进行中的旧跳转看到对不上就停
  let timer = 0
  let jumpTitle = null // 高亮所属会话的 document.title；title 变了就清掉
  let listFrame = 0

  const paint = () => {
    if (registry === null) return
    const all = chatRanges.concat(listRanges)
    if (all.length === 0) registry.delete('kg-find')
    else registry.set('kg-find', new Highlight(...all))
  }
  const setCurrent = (range) => {
    if (registry === null) return
    if (range === null) registry.delete('kg-find-current')
    else {
      const current = new Highlight(range)
      current.priority = 1
      registry.set('kg-find-current', current)
    }
  }
  const clearChat = () => {
    chatRanges = []
    jumpTitle = null
    setCurrent(null)
    paint()
  }

  // 侧栏结果的标题和摘录：搜索框有字时跟着结果刷新
  const refreshList = () => {
    listFrame = 0
    const input = doc.querySelector(JUMP_INPUT)
    const pattern = input === null ? null : jumpPattern(input.value)
    listRanges = []
    if (pattern !== null) {
      for (const cell of doc.querySelectorAll(`${JUMP_ROW} ${JUMP_ROW_TITLE}, ${JUMP_ROW} ${JUMP_ROW_SNIPPET}`)) {
        for (const m of jumpMatches(jumpCollect(cell, null), pattern)) listRanges.push(m.range)
      }
    }
    paint()
  }
  const scheduleList = () => {
    if (listFrame === 0) listFrame = view.requestAnimationFrame(refreshList)
  }
  // 正文流式输出时这里也会被叫很多次；每次只查一下搜索框，有字（或刚清空）才重算
  const mutations = new MutationObserver(() => {
    const input = doc.querySelector(JUMP_INPUT)
    if ((input !== null && input.value.trim() !== '') || listRanges.length > 0) scheduleList()
    if (jumpTitle !== null && doc.title !== jumpTitle) clearChat()
  })
  mutations.observe(doc.body, { childList: true, subtree: true, characterData: true })
  const titleWatch = new MutationObserver(() => {
    if (jumpTitle !== null && doc.title !== jumpTitle) clearChat()
  })
  if (doc.head !== null) titleWatch.observe(doc.head, { childList: true, subtree: true, characterData: true })

  // 对话在「跟住底部」时，凡是没有读者动作（滚轮、触摸、按下、翻页键、beforematch）
  // 的滚动，应用都会立刻贴回底部（ui-chat 的 ChatViewport.onIntent / onScroll）。
  // 先发一个 beforematch —— 浏览器页内查找展开内容时发的就是它，语义正合适 ——
  // 让应用当成读者自己在动，停止跟底。
  const scrollTo = (scroller, range, smooth) => {
    scroller.dispatchEvent(new view.Event('beforematch'))
    const r = range.getBoundingClientRect()
    const box = scroller.getBoundingClientRect()
    const top = scroller.scrollTop + (r.top - box.top) - (scroller.clientHeight - r.height) / 2
    scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
  }

  // 保险：刚加载完更早的历史时布局还会挪，跳完再守 JUMP_HOLD，被拽出视野就直接滚回来。
  // 用户自己滚动、点击或按键就不再管。
  let touched = false
  const onTouch = () => {
    touched = true
  }
  const hold = (id, scroller, range, since) => {
    touched = false
    const check = () => {
      if (id !== job || touched || !range.startContainer.isConnected) return
      if (Date.now() - since > JUMP_HOLD) return
      const r = range.getBoundingClientRect()
      const box = scroller.getBoundingClientRect()
      if (r.bottom < box.top || r.top > box.bottom) scrollTo(scroller, range, false)
      timer = view.setTimeout(check, JUMP_TICK)
    }
    timer = view.setTimeout(check, JUMP_TICK)
  }
  for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) doc.addEventListener(type, onTouch, true)

  const jump = (query, title, snippet) => {
    const pattern = jumpPattern(query)
    if (pattern === null) return
    const id = ++job
    view.clearTimeout(timer)
    clearChat()
    const began = Date.now()
    let loads = 0
    let lastText = -1
    let changedAt = began
    const tick = () => {
      if (id !== job) return
      const now = Date.now()
      if (now - began > JUMP_DEADLINE) return
      const titled = title === '' || doc.title.startsWith(title) || now - began > JUMP_TITLE_WAIT
      const scroller = doc.querySelector(JUMP_SCROLL)
      if (!titled || scroller === null) {
        timer = view.setTimeout(tick, JUMP_TICK)
        return
      }
      const collected = jumpCollect(scroller, scroller.querySelector(JUMP_COMPOSER))
      if (collected.text.length !== lastText) {
        lastText = collected.text.length
        changedAt = now
      }
      const matches = jumpMatches(collected, pattern)
      const pick = jumpPick(collected, matches, pattern, snippet, scroller)
      if (pick !== null) {
        chatRanges = matches.map((m) => m.range)
        jumpTitle = doc.title
        paint()
        setCurrent(pick.range)
        const folds = jumpFolds(pick.range, scroller)
        if (folds.length === 0) {
          scrollTo(scroller, pick.range, !reduced.matches)
          hold(id, scroller, pick.range, now)
          return
        }
        // 在折叠起来的过程里（一轮里最终回答之前的那些步骤）：照浏览器页内查找的做法，
        // 给折叠块发 beforematch，应用就展开它（ui-chat 的 useSearchableHidden）。
        // 子树不卸载，Range 一直有效；等 hidden 摘掉、展开动画走完再滚。
        for (const fold of folds) fold.dispatchEvent(new view.Event('beforematch', { bubbles: true }))
        const opened = Date.now()
        const reveal = () => {
          if (id !== job) return
          const shut = folds.some((fold) => fold.isConnected && fold.hasAttribute('hidden'))
          if (shut && Date.now() - opened < JUMP_REVEAL_WAIT) {
            timer = view.setTimeout(reveal, JUMP_TICK)
            return
          }
          timer = view.setTimeout(() => {
            if (id !== job) return
            scrollTo(scroller, pick.range, !reduced.matches)
            hold(id, scroller, pick.range, Date.now())
          }, JUMP_REVEAL_SETTLE)
        }
        timer = view.setTimeout(reveal, JUMP_TICK)
        return
      }
      // 还在渲染就再等等；静下来了还没有，就往前翻一页
      if (now - changedAt < JUMP_SETTLE) {
        timer = view.setTimeout(tick, JUMP_TICK)
        return
      }
      const older = doc.querySelector(JUMP_OLDER)
      if (older === null || loads >= JUMP_MAX_LOADS) return
      if (!older.disabled) {
        loads += 1
        changedAt = now
        older.click()
      }
      timer = view.setTimeout(tick, JUMP_TICK)
    }
    timer = view.setTimeout(tick, JUMP_TICK)
  }

  const onClick = (event) => {
    const target = event.target
    if (!(target instanceof view.Element)) return
    const row = target.closest(JUMP_ROW)
    if (row === null || target.closest('button') !== null) return
    const input = doc.querySelector(JUMP_INPUT)
    if (input === null) return
    jump(
      input.value,
      row.querySelector(JUMP_ROW_TITLE)?.textContent ?? '',
      row.querySelector(JUMP_ROW_SNIPPET)?.textContent ?? '',
    )
  }
  doc.addEventListener('click', onClick, true)

  return () => {
    job += 1
    view.clearTimeout(timer)
    if (listFrame !== 0) view.cancelAnimationFrame(listFrame)
    doc.removeEventListener('click', onClick, true)
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) doc.removeEventListener(type, onTouch, true)
    mutations.disconnect()
    titleWatch.disconnect()
    if (registry !== null) {
      registry.delete('kg-find')
      registry.delete('kg-find-current')
    }
  }
}
