# kawaii 2000s · dsh 皮肤

给 DeepSeek Harness 网页端的换皮肤：糖果粉 + 婴儿蓝的配色，满满 2000 年代。

## 截图

白天 | 夜间
---|---
<img src="screenshots/light.png" width="640" alt="kawaii 2000s 白天"> | <img src="screenshots/dark.png" width="640" alt="kawaii 2000s 夜间">

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

完事，打开 http://127.0.0.1:3080 就能看到粉粉的界面啦。

### 不想用了？

给 patch 里那行加 `disabled: true` 再重启，或者把上面加的两处都删掉。

## License

[MIT](./LICENSE)
