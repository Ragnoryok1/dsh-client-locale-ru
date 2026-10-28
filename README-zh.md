<!-- deepseek-harness-meta
{
  "name": "Russian (ru) language pack for DeepSeek Harness",
  "version": "0.2.22",
  "tags": ["localization", "russian", "i18n", "web-gui", "language-pack"],
  "description": "Russian for the DeepSeek Harness web GUI: the whole interface plus the menus of 520 third-party plugins — 594 sections, 69 177 strings.",
  "icon": "https://raw.githubusercontent.com/Ragnoryok1/dsh-client-locale-ru/main/assets/icon.png",
  "compatible_versions": ["v0.2.2-alpha.2", "v0.2.1-rc.3", "v0.2.1-rc.2", "v0.2.1-rc.1", "v0.2.1-alpha.5", "v0.2.1-alpha.4", "v0.2.1-alpha.3", "v0.2.1-alpha.2", "v0.2.1-alpha.1", "v0.2.0-rc.2", "v0.2.0-rc.1", "v0.1.7-rc.2", "v0.1.7-rc.1", "v0.1.7-alpha.2"],
  "screenshots": "images",
  "install_method": "dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru"
}
-->

# @ragnoryok1/dsh-client-locale-ru

[Русский](README.md) | [English](README-en.md) | **中文**

![DeepSeek Harness 俄语语言包](assets/banner.jpg)

[![npm](https://img.shields.io/npm/v/%40ragnoryok1%2Fdsh-client-locale-ru)](https://www.npmjs.com/package/@ragnoryok1/dsh-client-locale-ru)
[![license](https://img.shields.io/npm/l/%40ragnoryok1%2Fdsh-client-locale-ru)](LICENSE)
[![verify](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml/badge.svg)](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml)
[![dsh](https://img.shields.io/badge/dsh-0.2.2--alpha.2%2B-6366f1)](https://github.com/deepseek-ai/deepseek-harness)
[![namespaces](https://img.shields.io/badge/namespaces-594-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)
[![strings](https://img.shields.io/badge/strings-69177-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)

插件把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的界面变成俄语。你看到的一切都会被翻译：设置、侧边栏、对话框、提示、错误信息——以及没有自带俄语的三方插件菜单。

目前包里有 594 个分区、69 177 条文案，其中 520 份是第三方插件的词典——比我能找到的任何其他俄语包都多。

安装只需一条命令：`dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru`，然后在设置 General 里选择俄语。

除了翻译，插件还做三件 harness 自己做不到的事：按数字选择俄语复数形式（而不是中性标签）、套用俄语排版（«ёлочки»、长破折号、省略号），以及翻译没有自带 locale 的插件名称。每一项都能在配置里用一行关闭——翻译本身保留。

插件不会修改 harness 的文件，也不会碰你的数据。如果新版 harness 出现包里还没有的文案，它会保持英文：界面照常工作。MIT 许可，由社区维护，与 DeepSeek 无关联。

> **如果这个包对你有用，请给仓库点一颗 star。** 这是表明「有人需要这份翻译」的唯一信号，它也决定了接下来优先做哪些部分。

---

完整清单见 [NAMESPACES.md](NAMESPACES.md)：594 个 namespace、69,177 条字符串，随包附带的插件词典单独标注。

harness 树之外的插件用同样的方式翻译，但英文取自它们自己的发布物：`plugins/<namespace>.json` 记录包名、版本、许可证，以及从其 bundle 中提取的字符串。安装里还剩哪些英文，用 `npm run report:plugins` 查看：它遍历 profile 的 `node_modules`，找出每个插件自己的词典并与我们的对照；没有词典的插件会照实标注——在它请求翻译之前无从翻译。

`@linxin666` 这一族值得单独说明：十三个词典，每一个都已完整翻译——从几十条到四百条不等。

| 词典 | 包 | 条数 |
|---|---|---|
| `update` | `@linxin666/dsh-update` | 43 |
| `git-graph` | `@linxin666/dsh-client-ui-git-graph` | 63 |
| `dsh-web-ui-usage` | `@linxin666/dsh-usage` | 67 |
| `dsh-web-ui-session-archive` | `@linxin666/dsh-session-archive` | 124 |
| `pet` | `@linxin666/dsh-pet` | 81 |
| `remote` | `@linxin666/dsh-remote-web-ui` | 117 |
| `dsh-skill-explorer` | `@linxin666/dsh-client-ui-skill-explorer` | 114 |
| `dsh-web-ui-market` | `@linxin666/dsh-client-ui-market` | 106 |
| `liangshen` | `@linxin666/dsh-liangshen` | 42 |
| `dsh-web-ui-preset-center` | `@linxin666/dsh-client-ui-preset-center` | 46 |
| `dsh-ssh` | `@linxin666/dsh-ssh` | 158 |
| `task-board` | `@linxin666/dsh-client-ui-task-board` | 439 |
| `task-board-github` | `@linxin666/dsh-client-ui-task-board-github` | 113 |
| **合计** | 13 个词典 | **1,513** |

「插件」页面上的插件名称与说明无法由本包提供：harness 把她们放在每个包的 `locale/<语言>.json` 里并据此拼出翻译映射，而 locale 服务的 `resolveText` 根本不查词典。221 个 harness 包带有 `locale/en.json`，其中 219 个带有 `locale/zh.json`，**没有一个带 `locale/ru.json`**，所以这 261 行在任何语言包下都保持英文。这个缺口由 `scripts/descriptor-coverage.mjs` 单独统计；机制说明与 32 份已备好的译文见 [docs/descriptor-upstream.md](https://github.com/Ragnoryok1/dsh-client-locale-ru/blob/main/docs/descriptor-upstream.md)。

我们不复制别的包的俄语译文：那样无从核对，而审计是把我们的取值与同一个插件的英文模板作比较。另外提醒一点：如果配置文件里还有另一个自己注册俄语的包，语言就归先注册的那个——第二个会静默跳过自己的 namespace，界面上出现的就是别人的译文。

## 效果展示

语言列表中的俄语，以及已翻译的设置分区（截图截取自 `0.1.8` 构建：同一屏幕，但此后措辞和部分分区已有变化——例如字号说明现在写作 «Влияет только на содержимое диалога»）：

![俄语界面下的设置：语言、外观、主题](images/settings-ru.png)

![俄语界面下的插件列表：分区标题与「Экспериментально」标记](images/plugins-ru.png)

两张截图都沿面板左边界做了裁剪：工作区和会话的名称没有进入画面。

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）Web 界面的俄语语言环境（`ru`）。

插件通过 locale 语言包契约把**俄语**注册为可选语言：`ctx.locale.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' })`，并为每个 namespace 提供一份 `ru` 词典。在 Settings → General 中选择 **Русский** 后，界面会立即切换。

> **如果这个包帮到了你——请点一颗 star。** 这是说明这份翻译有人需要的唯一方式，而且它确实会影响接下来接手哪些任务。界面里的任何一个「喜欢」按钮都做不到这一点。
>
> 与此同时，仓库仍然是能看到翻译状态的地方：[CHANGELOG](CHANGELOG.md) 逐条拆解每个版本（包括在其中自己发现的错误）、CI 中的检查，以及一份有意不翻译的内容清单。

## 安装

这是一个**混合插件**（`dsh.bundle` + `dsh.client`），因此它像普通的 profile bundle 一样通过 `dsh plugin` 安装：

```sh
dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru
```

之后在下次启动 `dsh web` 时，设置里就会出现 **Русский**。无需再单独把 `pnpm add` 装进已构建的 `dsh web`——插件通过 `locale` 服务接入内置语言环境。

清单按 harness 自身的规则检查，而不是靠肉眼（`npm run check:manifest`，包含在 `verify` 中）。每一条规则都取自 harness 源码，每一条都对应一种否则会先落到用户头上的失败：`parseDshClient` 接受任意字符串作为 `platform`，但消费方只保留 `platform === 'web'` 的行，因此写成 `'Web'` 这样的笔误会**悄悄关掉**客户端那一半；声明了 `dsh.client` 却没有 `./client` 导出会让 `client-modules` 抛错；`dsh.bundle.patch` 必须指向确实存在的文件。

从 GitHub 安装同样可用：`dsh plugin --profile web add Ragnoryok1/dsh-client-locale-ru`（插件目录生成的就是这种不带 npm scope 的写法）安装的是仓库归档，而构建好的 `lib/` 已提交进 git——你的机器上不会运行构建，也不需要运行。正因如此，`npm run check:built`（包含在 `verify` 中）会重新构建 `lib/` 并与提交内容比对：git 里过期的构建产物会直接落到用户手里，而审计看不到它——审计读的是源码。发布的包为 2023 kB：横幅以 JPEG 提供，图标与源码映射不进入 npm 包。

## 为什么是混合插件

`dsh web` 只从 **workspace 包**中加载客户端（UI）插件，仅带一个 `dsh.client` 的外部 npm 包不会被识别。要让带 UI 部分的外部插件可安装，它必须声明 **`dsh.bundle`**（profile 层），再由其 `cordis.patch.yml` 通过 `- insert:` 把客户端条目 `locale-ru` 加入浏览器 roster。其他第三方插件（例如 `@zseven-w/dsh-android`）也是同样的结构。

## 工作原理

- **宿主部分**（`lib/index.js`）——空的 `apply()`：语言插件不需要服务端逻辑，它只是为 Loader 提供一条正确的 cordis 条目。
- **浏览器部分**（`lib/client.js`）——通过 `locale` 服务（从 `ctx` 注入）注册 `ru` 和词典。没有框架的运行时导入——只有这个服务。
- **没有运行时依赖**——`lib/client.js` 不导入其他包，因此不会拖入沉重的依赖。
- **副作用**——语言和词典通过 `ctx.effect(...)` 注册，因此会随插件一起卸载（对 HMR 安全）。
- **复数形式**——locale 契约不包含复数规则：组件按 `count === 1 ? 'ключ.one' : 'ключ.other'` 选择形式，而俄语需要三种（1 вызов / 2 вызова / 5 вызовов）。本包接管了这件事：词典在 `.one` 与 `.other` 之外还提供 `.few` 和 `.many`，并通过对运行时 `translate` 的包装，用 `Intl.PluralRules('ru')` 为任何带有数字 `count` 或 `n` 的调用重新计算形式。决定形式的是数字，而不是组件选中的 key，因此 «2 вызова инструментов» 和 «5 вызовов инструментов» 出自同一个调用点。形式并不限于成对的 key：当 harness 把数字传给一个它从未配对的 key（如带 `{n}` 的 `terminal.expand`）时，本包会为它补上自己的 `.one` / `.few` / `.many`——«Показать ещё 1 строку / 3 строки / 7 строк»——包装层也会为这类 key 查找形式。在形式不适用处（一句话里出现多个数字），取值被改写为对数字中性：用 «Символов: {total}» 代替 «{total} символов»，用 «файлов: {files}» 代替 «{files} файлов»。由 `npm run check:plural` 检查——五个用例，包含未配对的 key 与小数。
- **回退**——缺失的俄语 key 会回退到 `en`（配置的 `fallback`）。

## 排版

本包会把已经渲染出来的俄语文本按排版规则处理：用「ёлочки」（« »）代替直引号，用长破折号代替词与词之间的连字符，用省略号代替三个点，在数字与其后的词语或计量单位之间加不换行空格（以免 «187 плагинов» 被折成两行），并在短词——前置词、连词或语气词——之后加同样的空格：«в режим» 会整体换行，而不会把 «в» 单独留在行尾。这些规则有意保持保守：只在无歧义的模板上生效，而代码、输入框、可编辑文本以及带 `data-typography="off"` 的元素完全不会被触碰。重复处理不会带来任何变化。

数字区间规则（«5–10» 用短横线）**有意没有加入**：整个包中唯一在两个数字之间出现连字符的地方是 cron 表达式示例 `0 9 * * 1-5`，换成短横线会把它改坏。这是实测结论，而非假设。

这些规则由脚本检查，而不是靠肉眼：`npm run check:typography`。

排版处理只看到文本节点，而词典取值还会进入属性——`title`、`aria-label`、`placeholder`——它根本到不了那里。因此取值单独检查：包内不能出现直引号、用连字符代替破折号、没有空格的长破折号，或三个点。否则同一个字符串会因为落点不同而呈现两种样子，而提示与朗读标签里则完全没有规则生效。

**第一次处理之后**发生变化的文本——令牌计数器、计时器、进度——会被再次处理，因此实时的 «4 с» 仍保留不换行空格。这一点在真实文档上验证，而不只是对字符串：`npm run check:typography:dom`（jsdom：首次处理、文本变更、新增子树、卸载停止、其他语言，以及语言切换）。

该处理**仅在俄语处于活动状态时**运行：规则是俄语的，把它们用于其他语言会改动本包并不拥有的文本——英文界面里的 `"quotes"` 会变成 «quotes»。本包监听 `locale/change`，在切换语言时启动或停止处理，而不是在安装时。

## 插件名称

插件的名称来自它自己的 `locale/<语言>.json` 文件，而本地化服务解析这张映射时不会去查已注册的词典——它自己的文档写着 «maps do not consult registered dictionaries»。因此词典无法翻译插件名称：本包拿不到别的包的映射，英文名称会一直是英文，直到插件自己带上 `locale/ru.json`。

本包自带这些名称：32 个 harness 插件的名称，以及 33 个第三方插件的名称与说明（这些插件的词典本包在翻译）。每一项都记着翻译所依据的英文文本和俄文文本。已经渲染出来的界面会经过一个处理流程，把俄文放到英文的位置上：插件卡片、bundle 的组成行、插件详情页以及设置中的插件清单。朗读用的名称（`aria-label`）也会一并替换，因此整张卡片读起来都是俄文。

这个流程只做精确匹配：整段文本与本包知道的标题或说明完全相同时才会替换。只是提到了某个名称的句子保持原样；代码、输入框和对话不会被触碰。与排版流程一样，它只在俄文是当前语言时工作。

同样这 32 个名称会作为补丁（`docs/harness-descriptors-ru.patch`）送到 harness：在 harness 自己的界面里插件也有俄文名称，而这个补丁先到。补丁是构建产物——它由翻译和 harness 目录树生成，门禁 `npm run check:descriptor-patch` 在生成的补丁与仓库里那份不一致时失败。第三方插件的名称放在 `src/client/plugin-names-ru.json`：这个文件由插件词典生成（`npm run build:plugin-names`），门禁 `npm run check:plugin-names:map` 在它与词典不一致时失败。同一个英文名称不能有两种译法——harness 与插件各说各话。`npm run check:plugin-names` 在真实文档上证明（jsdom，12 个用例）这个流程会翻译标题、说明、朗读名称和 bundle 的一行，而该不动的它不动。


## 想把 harness 翻译成自己的语言

我们走过的顺序、坑和检查都整理在 [docs/how-to-translate-dsh.md](docs/how-to-translate-dsh.md)：
如何找到各个命名空间、为什么不能跨文件按 key 收集模板、运行时依赖变更会怎样影响译文，
以及如何把发布交给 CI。

## 许可证

MIT

## 变更历史

[CHANGELOG.md](CHANGELOG.md)——每个版本都有什么。
