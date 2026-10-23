// 把 lib/skin.css 和 lib/sidebar-hover.js 打成 dsh 客户端插件 bundle(lib/client.js)。
// dsh 的客户端模块系统是「惰性 CJS 表」:执行 bundle 只登记 factory,
// 所有副作用(含 CSS 注入)发生在 factory 体内、materialize 的时候;
// 悬浮监听则挂在 apply(ctx) 的 ctx.effect 里,插件卸载时跟着撤掉。
// 改完跑 `node build.mjs`,然后重启 dsh。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ID = 'dsh-skin-kawaii2000'
const TAG_ID = `${ID}/skin.css`

const css = readFileSync(join(here, 'lib', 'skin.css'), 'utf8')
// 原样内联进 factory，每行缩进两个 tab 对齐 bundle
const hover = readFileSync(join(here, 'lib', 'sidebar-hover.js'), 'utf8')
  .trimEnd()
  .split('\n')
  .map(line => (line ? `\t\t${line}` : line))
  .join('\n')

const bundle = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
\t\t//#region lib/skin.css
\t\tconst css = ${JSON.stringify(css)};
\t\tconst tagId = ${JSON.stringify(TAG_ID)};
\t\tif (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
\t\t\tconst tag = document.createElement("style");
\t\t\ttag.dataset.plugin = ${JSON.stringify(ID)};
\t\t\ttag.dataset.pluginCss = tagId;
\t\t\ttag.textContent = css;
\t\t\tdocument.head.appendChild(tag);
\t\t}
\t\t//#endregion
\t\t//#region lib/sidebar-hover.js
${hover}
\t\t//#endregion
\t\t//#region lib/client.js
\t\t/** Client half of the skin plugin: the stylesheet, plus hover-to-open for the collapsed sidebar. */
\t\tfunction apply(ctx) {
\t\t\tif (typeof document === "undefined") return;
\t\t\tctx.effect(() => installSidebarHover(document), "kawaii2000: hover opens sidebar");
\t\t}
\t\t//#endregion
\t\texports.apply = apply;
\t\treturn module.exports;
\t}
});
`

writeFileSync(join(here, 'lib', 'client.js'), bundle)
console.log(`built lib/client.js (${bundle.length} bytes, css ${css.length} bytes)`)
