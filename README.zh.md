# 糖果毛玻璃 · dsh 皮肤

[English](./README.md)

给 DeepSeek Harness 网页端的换皮肤：一张饱和的糖果色桌面，桌面上浮着一整扇
毛玻璃窗 —— 玫粉、丁香、天蓝从玻璃里透上来。

## 截图

白天 | 夜间
---|---
<img src="screenshots/light.jpg" width="640" alt="糖果毛玻璃 白天"> | <img src="screenshots/dark.jpg" width="640" alt="糖果毛玻璃 夜间">

## 毛玻璃是怎么做出来的

- **玻璃得有个桌面可透。** body 铺一张饱和的糖果极光 + 暗角，整扇应用四周留
  14px 生底浮在上面 —— 玻璃要有边界，才读得出来是玻璃。
- **全套只有一种阴影语言。** 每个面都是「外圈 1px 亮边 + 内顶 1px 高光 + 一团
  带颜色的柔和投影」，全站没有一处灰影。
- **圆角只有四档。** 8 / 12 / 16 / 22px，配 `corner-shape: superellipse(1.6)`，
  让边角像糖块而不是 CSS 圆。
- **饱和度是配给的。** 全站只有两处允许饱和 —— 「新会话」和「发送」。其余一律
  乳白玻璃，这两处才像动作。
- **对比度对着真实玻璃算。** 墨色 / 次级 / 链接是拿渲染后的面色量的
  （白天 13:1 / 7.5:1 / 5.2:1），不是对着白底算。
- **该退的时候退。** 系统要求减少透明时玻璃退回实色，要求减少动效时全站过渡
  直接关掉。

## 安装

三步搞定：

**1.** `~/.dsh/profiles/web/package.json` 的 `dependencies` 里加一行：

```json
"dsh-skin-kawaii2000": "github:shunkwon/dsh-skin-kawaii2000"
```

**2.** `~/.dsh/profiles/web/cordis.patch.yml` 里加一段：

```yaml
- insert:
    - id: skin-kawaii2000
      name: dsh-skin-kawaii2000
```

**3.** 装包、重启 dsh：

```bash
cd ~/.dsh/profiles/web
pnpm install
```

完事，打开 http://127.0.0.1:3080 就是一块毛玻璃啦。

> 包名仍是 `dsh-skin-kawaii2000`（loader 里那行也不用改）：2.0 把 2000 年代的
> 斜角换成了毛玻璃，但沿用原来的 id，现有 profile 不用改 patch 就能升级。
> v1 那一版留在 git 的 `v1-kawaii2000` 标签上。

### 不想用了？

给 patch 里那行加 `disabled: true` 再重启，或者把上面加的两处都删掉。

## License

[MIT](./LICENSE)

## 维护提示：`[class*=…]` 请只挂一层

皮肤靠 `[class*="_xxx"]` 匹配组件内部类名（类名形如 `<hash>_<local>`，后缀稳定）。
substring 匹配很容易命中嵌套子节点 —— 比如 `[class*="_card"]` 会同时命中
`li.card` 和 `cardHead` / `cardMain` / `cardDesc` / `cardIcon`，给每一层都套上
圆角描边，看起来像一条白条盖住了文字。

改完样式后，在浏览器控制台粘 [tools/audit-nesting.js](./tools/audit-nesting.js)
跑一遍（插件页、设置→内置插件、对话、首屏各跑一次），输出为空才算干净。
