# 粉红小屋 — dsh 皮肤 (kawaii 2000s)

给 DeepSeek Harness 网页端 (`dsh --profile web`, 默认 http://127.0.0.1:3080) 的皮肤。

把 2000-2002 门户站的设计语汇换成可爱变体:**窗体骨架仍是 Win2000 斜角控件,
配色换成糖果粉 + 婴儿蓝**。规则与机构版同源,没有放松:

- 零圆角、零渐变 —— 立体只来自双色斜角边,不来自模糊投影
- 一切彩色落在 216 色 web-safe 六档 (`00/33/66/99/cc/ff`)
- 对比度对着**实际面色**算,不是对着白底
- 系统字体栈,零远程依赖

## 安装(通过 GitHub)

1. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 里加:

   ```json
   "dsh-skin-kawaii2000": "github:shunkwon/dsh-skin-kawaii2000"
   ```

2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 里加:

   ```yaml
   - insert:
       - id: skin-kawaii2000
         name: dsh-skin-kawaii2000
   ```

3. 在 profile 目录跑 `pnpm install`,然后重启 dsh。

   更新皮肤:`pnpm install --force`(清掉 pnpm 的 git 缓存)+ 重启。

   > 注意:loader 行解析不到包时 dsh 会拒绝启动(exit 1)。若报
   > `Cannot find package 'dsh-skin-kawaii2000'`,删掉 patch 里那段即可开机。

## 调色板

| 用途 | 白天 | 夜间 |
|---|---|---|
| 窗体面色 `--k-face` | `#ffccff` 糖果粉 | `#660066` |
| 次级面 `--k-face2` | `#ffcccc` | `#663366` |
| 地色/侧栏 `--k-ground` | `#ff99cc` | `#330033` |
| 凹陷井 `--k-well` | `#ffffff` | `#330033` |
| 标题带 `--k-band` | `#993366` | `#993366` |
| 主操作键 `--k-primary` | `#cc0066` | `#ff99cc` |
| 代码纸 `--k-note` | `#ffffcc` 经典淡黄 | `#333300` |
| 对方气泡 `--k-cyan` | `#ccffff` 婴儿蓝 | `#003333` |

对比度(白天,对着面色 `#ffccff` 算,门槛 4.5:1):

- 正文黑 `#000000` → **15.33**
- 状态三色 `#006600` / `#993300` / `#990000` → **5.29 / 5.42 / 6.51**
- 白字 on 标题带 `#993366` → **6.95**;白字 on 主操作键 `#cc0066` → **5.59**

## 工作原理

dsh 的样式全部走 `--dsw-*` 设计令牌,所以皮肤只做一件事:**注入一张覆盖令牌的
样式表**,不碰组件代码。

选择器一律写成 `html body`(特指度 0,0,2),压过主题包的 `body`(0,0,1),
因此**与样式表插入顺序无关**,不依赖插件加载次序。

只有几何(边框宽度/四色斜角/圆角)带 `!important` —— 组件 CSS 用 class
特指度(0,1,0)会压过 `html body button`(0,0,3)。**底色不强制**,留给令牌层
解析,这样主操作键保住自己的品牌填色,透明图标键则透出所在面色。

## 改配色

1. 编辑 `lib/skin.css`
2. `node build.mjs` —— 重新生成 `lib/client.js`(客户端插件 bundle)
3. **刷新浏览器页面**(不必重启 dsh)

host 是**按需哈希** bundle 的:文件一变,首页 boot graph 里的
`/plugins/dsh-skin-kawaii2000/client.js?rev=…` 就换新 rev,bundle 本身带
`cache-control: no-cache`。所以改完 CSS 只要重新加载页面。

只有**增删插件行**(改 `cordis.patch.yml`)才需要重启 dsh —— 那是启动时合成的。

> 排查口诀:改了没生效,先 `curl -s http://127.0.0.1:3080/ | grep -o 'kawaii2000/client.js?rev=[a-f0-9]*'`
> 看 rev 变没变。变了就是浏览器页面陈旧,刷新即可;没变才是构建没跑。

`lib/client.js` 是生成物,别手改。

## 开关

在 `~/.dsh/profiles/web/cordis.patch.yml` 里:

```yaml
- insert:
    - id: skin-kawaii2000
      name: dsh-skin-kawaii2000
      disabled: true      # ← 加这行关掉皮肤
```

重启生效。

> **注意:loader 行解析不到包时 dsh 会拒绝启动**(不是降级成无皮肤,是 exit 1,
> 端口都不监听)。所以本包同时写进了 `~/.dsh/profiles/web/package.json` 的
> `dependencies`(`link:../../skins/kawaii2000`),让 pnpm 重建软链而不是剪掉它。
> 若哪天启动报 `Cannot find package 'dsh-skin-kawaii2000'`,把 `cordis.patch.yml`
> 里那段 insert 删掉即可开机。

## 已验证

headless Chrome + CDP 读计算样式(模型看不了截图,视觉必须程序化验证):

- `border-radius` 违规元素 **0**
- `linear-gradient` 元素 **0**(全页唯一一处是侧栏截断淡出遮罩,已清除)
- 冷银灰残留(`#e8e9ea`/`#e2e3e4`/`#dcdcdc`/`#f2f2f2`)**0**
- 斜角方向:按钮上/左 `#ffffff`、下/右 `#993366`;输入框反向凹陷
- 明暗两套分支令牌均正确解析,样式表 31 条规则全部生效无丢弃
- 排版:正文宋体、粗体走黑体(宋体无中文粗体)、代码 Courier + 淡黄纸黑框、
  表格黑网格、`♥` 列表符、`[+]/[−]` 折叠标记
- 标签页(对话/轨迹):实测真实 DOM —— 选中 `52×25`、未选中 `52×23`,相邻无缝
  (gap 0),两者同一套黑框、底边敞口并入面板;`::after` 强调条 `display:none`
- 页头分隔线 `#cc99cc` 柔和;同时**结构框线仍是黑的**(表格单元格 `rgb(0,0,0)`、
  代码块 `rgb(0,0,0)`)

> **返工教训一:给容器加边框前先量容器宽度。** 想做 Win2000 标签条的形状,
> 给 `[role="tablist"]` 加了 1px 黑基线,结果 `.wSkVaW_tabs` 容器宽 **1112px**
> (整个对话面板)而两个标签才占约 100px —— 基线画成了贯穿全宽的黑线。已去掉。
>
> **返工教训二:元素边框扫描看不见伪元素,别据此断言「没有线」。** 去掉上面
> 那条基线后仍有一条黑线,两轮扫描都报「无」,因为真凶是
> `.wSkVaW_header::after`(`background: var(--dsw-alias-border-l2)`,
> `position:absolute; height:1px; left:0; right:0`)—— 伪元素没有
> `getBoundingClientRect`,遍历元素自身 border 永远抓不到。**决定性手段是
> `Page.captureScreenshot` 看渲染结果 + `elementsFromPoint` 抓那一点的元素栈
> 连同 `getComputedStyle(el, '::after')`。**
>
> **返工教训三:别把 `--dsw-alias-border-l1..l4` 全设成纯黑。** 它们原值是
> `rgba(0,0,0,.04 ~ .16)` 的发丝线,是应用到处用的「顺带一条线」;设成纯黑
> 等于全站加粗十倍,页头那条就是这么变成黑杠的。结构框线(表格/代码块/控件/
> 标签)不走这些令牌,直接用 `--k-frame` 黑即可,门户骨架不受影响。

未覆盖:对话视图(消息气泡/长 markdown)需要真实会话才能渲染,只用注入的
测试 DOM 验证了排版规则本身。

## 已知取舍

- **字号没有全局压到 12px**。dsh 组件 CSS 用的是硬编码 px(不是 rem),
  没有单一杠杆能整体缩放;强行逐条覆盖会跟每次版本升级打架。正文按 14px
  宋体走。
- **没铺墙纸**。主内容区底色画在内层容器上,`body` 上的平铺图根本露不出来;
  铺到内层又会让长正文压在花纹上。
