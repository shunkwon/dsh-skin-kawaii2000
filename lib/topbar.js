/*
 * 顶栏布局 —— 收起侧栏后不留左边那条 56px 图标栏，侧栏开关和新会话挪到左上角。
 *
 * dsh 的布局包本来就有这种摆法，只是只给 Windows 桌面版开：html 上有
 * data-windows-titlebar 时，收起列宽从 56 变 0（ui-layout 渲染时读这个属性），
 * 侧栏开关固定到左上角、新会话排在它右边，其余几块收起时直接隐藏（ui-sidebar 的
 * CSS），提示气泡改到按钮下方（ui-sidebar 的 JS）。这里只是替浏览器把这个模式打开，
 * 具体落位由 skin.css 的「6b. 顶栏」接管。
 *
 * 标题栏高度设成 0：桌面版会在所有列上方另留一条标题栏、模态遮罩也会让开它；
 * 这里的顶栏就是会话页头那一行，不需要额外的那条。
 *
 * 不用 data-platform="darwin"：快捷键包看到它就会当自己跑在 Electron 里，
 * 把可配置的快捷键交给浏览器里并不存在的原生菜单。
 *
 * 本文件由 build.mjs 原样内联进 lib/client.js 的 factory，不是 ES 模块，别写 export。
 */
const TOPBAR_ATTR = 'data-windows-titlebar'
const TOPBAR_HEIGHT_VAR = '--dsh-windows-titlebar-height'

/** 打开顶栏模式，返回撤销函数（插件卸载时把属性和变量一起拿掉）。 */
function installTopbar(doc) {
  const root = doc.documentElement
  // 桌面版（preload 设了 data-platform，或者已经是真的 Windows 标题栏）有自己的窗口
  // chrome，不掺和；skin.css 的顶栏一节只认 data-kg-topbar，那里一样不生效
  if (root.dataset.platform !== undefined) return () => {}
  if (root.hasAttribute(TOPBAR_ATTR) && !root.hasAttribute('data-kg-topbar')) return () => {}
  root.setAttribute(TOPBAR_ATTR, '')
  root.setAttribute('data-kg-topbar', '')
  root.style.setProperty(TOPBAR_HEIGHT_VAR, '0px')
  return () => {
    root.removeAttribute(TOPBAR_ATTR)
    root.removeAttribute('data-kg-topbar')
    root.style.removeProperty(TOPBAR_HEIGHT_VAR)
  }
}
