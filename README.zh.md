<!-- deepseek-harness-meta
{
  "name": "Russian (ru) language pack for DeepSeek Harness",
  "version": "0.2.0",
  "tags": ["localization", "russian", "i18n", "web-gui", "language-pack"],
  "description": "Full Russian interface for the DeepSeek Harness web GUI: 53 namespaces, 2418 translated strings, Russian screen typography, and a locale audit in CI pinned to a harness tag. Includes the automation-task manager and the reminder catalog.",
  "icon": "https://raw.githubusercontent.com/Ragnoryok1/dsh-client-locale-ru/main/assets/icon.png",
  "compatible_versions": ["v0.2.1-alpha.1", "v0.2.0-rc.2", "v0.2.0-rc.1", "v0.1.7-rc.2", "v0.1.7-rc.1", "v0.1.7-alpha.2"],
  "screenshots": "images",
  "install_method": "dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru"
}
-->

# @ragnoryok1/dsh-client-locale-ru

[Русский](README.md) | [English](README.en.md) | **中文**

![DeepSeek Harness 俄语语言包](assets/banner.png)

[![npm](https://img.shields.io/npm/v/%40ragnoryok1%2Fdsh-client-locale-ru)](https://www.npmjs.com/package/@ragnoryok1/dsh-client-locale-ru)
[![license](https://img.shields.io/npm/l/%40ragnoryok1%2Fdsh-client-locale-ru)](LICENSE)
[![verify](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml/badge.svg)](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml)
[![dsh](https://img.shields.io/badge/dsh-0.2.1--alpha.1%2B-6366f1)](https://github.com/deepseek-ai/deepseek-harness)
[![namespaces](https://img.shields.io/badge/namespaces-53-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)
[![strings](https://img.shields.io/badge/strings-2%2C418-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面（`dsh`）的俄语（`ru`）语言包。它通过 locale 服务（`ctx.locale.addLanguage`）把 `ru` 注册为可选的客户端语言，并为每个 namespace 提供一份词典——共 53 个 namespace、2,418 条翻译，基于 dsh `0.2.1-alpha.1` 构建。用 `dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru` 安装，然后在 Settings → General 中选择 **Русский**。缺失的 key 会回退到英文，因此更新的 harness 也能照常工作。覆盖范围仅限 harness 自带的客户端界面——第三方插件的词典有意不纳入范围，而下载量最高的 17 个生态插件中有 11 个不提供自己的字符串，所以它们通过这些 namespace 已经是俄语界面了。MIT 许可，由社区维护，与 DeepSeek 无隶属关系。

> **如果这个包对你有用，请给仓库点一颗 star。** 这是表明「有人需要这份翻译」的唯一信号，它也决定了接下来优先做哪些部分。

---

## 效果展示

语言列表中的俄语，以及已翻译的设置分区（截图截取自 `0.1.8` 构建）：

![俄语界面下的设置：语言、外观、主题](images/settings-ru.png)

![俄语界面下的内置插件：计数单位为「N плагинов」](images/plugins-ru.png)

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

## 为什么是混合插件

`dsh web` 只从 **workspace 包**中加载客户端（UI）插件，仅带一个 `dsh.client` 的外部 npm 包不会被识别。要让带 UI 部分的外部插件可安装，它必须声明 **`dsh.bundle`**（profile 层），再由其 `cordis.patch.yml` 通过 `- insert:` 把客户端条目 `locale-ru` 加入浏览器 roster。其他第三方插件（例如 `@zseven-w/dsh-android`）也是同样的结构。

## 工作原理

- **宿主部分**（`lib/index.js`）——空的 `apply()`：语言插件不需要服务端逻辑，它只是为 Loader 提供一条正确的 cordis 条目。
- **浏览器部分**（`lib/client.js`）——通过 `locale` 服务（从 `ctx` 注入）注册 `ru` 和词典。没有框架的运行时导入——只有这个服务。
- **没有运行时依赖**——`lib/client.js` 不导入其他包，因此不会拖入沉重的依赖。
- **副作用**——语言和词典通过 `ctx.effect(...)` 注册，因此会随插件一起卸载（对 HMR 安全）。
- **复数形式**——locale 契约不包含复数规则（没有 ICU/`Intl.PluralRules`），组件按 `count === 1 ? 'ключ.one' : 'ключ.other'` 选择形式。俄语在 `n ≥ 2` 时需要三种形式（2 задачи / 5 задач），因此单条 `.other` 字符串不可能永远正确。本包在**不**改动上游的前提下解决这个问题：`.one`（即恰好 `n = 1`）写自然形式，而 `.other` 用在任意 `n ≥ 2` 下都成立的构造（«Субагентов: 3»、«Фоновых задач: 5»）或不变的缩写（«каждые 2 ч»、«ещё 3 стр.»）。不会有任何一条可见字符串显示错误的数形式。
- **回退**——缺失的俄语 key 会回退到 `en`（配置的 `fallback`）。

## 排版

本包会把已经渲染出来的俄语文本按排版规则处理：用「ёлочки」（« »）代替直引号，用长破折号代替词与词之间的连字符，用省略号代替三个点，并在数字与其后的词语或计量单位之间加不换行空格（以免 «187 плагинов» 被折成两行）。这些规则有意保持保守：只在无歧义的模板上生效，而代码、输入框、可编辑文本以及带 `data-typography="off"` 的元素完全不会被触碰。重复处理不会带来任何变化。

这些规则由脚本检查，而不是靠肉眼：`npm run check:typography`。

## 检查

```sh
npm run build             # сборка трёх выходов
npm run check:typography  # 12 правил типографики, включая «не трогать»
npm run audit -- <дерево харнеса>   # аудит локали
npm run verify -- <дерево харнеса>  # всё вместе
```

审计在 CI（`.github/workflows/verify.yml`）中针对**锁定的 harness 标签**运行，而不是针对随便一份本地 checkout。有两项内容作为门禁检查，而且两者都已经抓到过真实的缺陷：

- **无效 namespace**——包注册的每一个 namespace 都必须在 harness 中存在。在 0.1.6 中，日程目录的翻译被注册在 `schedule.manager` 名下，而读取它们的是 `schedule.catalog`：此时按 key 做的覆盖率检查还报告「全部已翻译」；
- **复数形式配对**——`.one`/`.other` 的集合必须一致，因为客户端按 `count === 1 ? '.one' : '.other'` 选择形式。

覆盖率数字会被打印出来，但它不是门禁：精确的「新增 / 删除」清单需要**按 namespace** 比较 key（这由发布工具完成），而全局比较 key 名称会把包有意保留英文的分区也标出来。

## 覆盖范围：仅官方界面

本包翻译的是 **harness 客户端自有的 namespace**——共 53 个 namespace，已与锁定标签核对。第三方插件的词典有意不在范围内，原因如下。

我们检查了生态中下载量最高的 17 个插件（npm、`keywords:dsh-plugin`、月下载量），看其中哪些会提供自己的字符串：

| 发现的情况 | 插件数 |
|---|---|
| **没有自己的字符串**——界面文本取自 harness 的 namespace | **17 个中的 11 个** |
| 较大的自有词典（已人工确认） | 2 个——`dshmarket`（约 1262 个 key）、`@nanmicoder/dsh-agent-teams`（420） |
| 只有 `.d.ts` 类型，没有字符串 | 1 个——`dsh-plugin-model-proxy` |
| 需要单独检查 | 3 个 |

实际结论：在最流行的插件中，**17 个里有 11 个**的俄语界面已经可用——它们的文本位于 harness 的公共 namespace 中，而本包已把这些 namespace 完整翻译。只有插件自带字符串时才需要单独的词典，而这样的词典意味着一份要跟进别人发布节奏的责任：`dshmarket` 已经到 1.66.3 版本，它的 key 变化与 harness 无关。

所以这里只有一个包、一份承诺：**官方界面，已翻译并经过检查**，不去追赶别人的词典。需要某个具体插件——请开 issue：可以为它做一个绑定版本的独立层词典，而不是默默地承诺「全部都覆盖了」。

## 开发

```sh
pnpm install
pnpm run build     # tsdown -> lib/index.js (node half) + lib/client.js (client bundle)
npm pack           # -> ragnoryok1-dsh-client-locale-ru-<version>.tgz
```

`lib/client.js` 会编译成 `dsh` 客户端加载器（`__ModuleLoader__.load`）能够识别的格式，并导出 `inject`/`apply`。

## 发布

发布到 npm 由 `publish` workflow 按标签执行——凭据保存在仓库 secret（`NPM_TOKEN`）中，因此既不需要在终端里输入 token，也不需要转发它。从本机手动发布是可行的，但没有必要。

```
npm version 0.3.0 --no-git-tag-version      # поднять версию в package.json
# …и синхронно обновить версию в блоке deepseek-harness-meta в этом README
git commit -am "release: 0.3.0" && git tag v0.3.0 && git push origin v0.3.0
```

发布前 workflow 会检查：

1. 标签中的版本与 `package.json` 中的版本一致；
2. `deepseek-harness-meta` 块中的版本与 `package.json` 一致——marketplace 从那里读取版本，而且**只在首次索引时**读取，因此版本不一致不会自行修正；
3. 排版（12 条规则）；
4. 针对锁定 harness 标签的本地化审计——无效 namespace、重复项和复数形式配对会报错并中止发布。

在本地做完全相同的检查，但不发布：

```
npm run verify -- путь/к/дереву/харнесса
```

该 workflow 还支持手动触发，并带有「只检查、不发布」的开关（`workflow_dispatch` → `dry-run`）。

## 内容

- `src/client/dicts.ts`——俄语词典（53 个 namespace、2418 条翻译、约 2900 行）。这正是本包的核心价值。
- `src/client/index.ts`——客户端插件入口（注册 `ru` 和词典）。
- `src/index.ts`——空的宿主部分（`apply()`）。
- `cordis.patch.yml`——profile 补丁（`- insert:` 客户端条目 `locale-ru`）。

## 翻译内容

当前键集按 harness 的标签确定：key 取自对应 profile 的提交，之后新增的 key 在查找时会回退到 `en`，因此本包不会在新版本上弄坏界面。

### 0.1.7 — 修复无效 namespace，翻译任务管理器，重写复数形式

本版本的重点是**修复 0.1.6 中的错误**。当时记录说 namespace `schedule.catalog` 已被取消，位置由 `schedule.manager` 取代。实际上 harness 中**两个** namespace 各自独立存在：`schedule.catalog` 是会话头部带有频率和单位的提醒目录，`schedule.manager` 则是新的自动化任务管理器。由于这个错误结论，约 30 条翻译字符串（提醒、频率、时间单位）被注册在一个无人读取的名称下，**从未显示**在界面中。现在该目录注册为 `schedule.catalog`。

- **已修复：**日程目录的翻译重新可见——`trigger.*`、`list.*`、`delete.*`、`frequency.*`、`cron.*`、`unit.*`、`relative.*`、`mark.aria`、`hover.more`；
- **新增 `schedule.manager`**（188 个 key）——完全俄语化的自动化任务管理器：任务面板与任务目录、搜索、状态筛选、任务详情及其标签页、带保留规则的**运行日志**、日程编辑器（日期、时间、时、分、秒、时区、重复间隔）、重复规则（一次性、每 N 分钟/小时/秒、每天、周一至周五、每周、自定义 cron）、可选择日期和分钟的 cron 表单、带确认的删除、通知与卡片；
- **重写复数形式**（17 组 key）：把在 2–4 这些数字上出错的写法，换成在任意 `n ≥ 2` 下都正确的写法——例如 «2 субагентов» → «Субагентов: 2»、«каждые 2 часов» → «каждые 2 ч»。另有 8 条把 `{count}` 放在需要变格的词之前的字符串改用缩写：«ещё 3 строк» → «ещё 3 стр.»；
- **新增 7 个此前缺失的 key**：`blocked.composer`、`defaultWorkspace.title`、`schedule.active`、`settings.transcript.expanded`、`status.scheduled`、`status.overdue`，以及 namespace `shortcuts.layout`（显示左侧面板的命令标签）；
- **项目中的新检查：**namespace 名称审计。此前的覆盖率检查只比对 namespace 内部的 key，却不比对名称本身，因此整个 namespace 可能注册在一个不存在的名称下并悄悄失效。现在会从所有声明方式（`const NS`/`SETTINGS_NS`/`namespace`、`locale.register`、`locale.bind`、`PropsLocale<…>`）中提取名称，并按集合比较。

0.1.2 新增了 0.1.1 中没有的分区：`open-in-app`（«Открыть в приложении»）、`sidebarFiles`、`sidebarRight`（带文件的右侧边栏）和 `sidebarCodePreview`（代码预览）。同时更新了在 harness 0.1.5 中发生变化的 key，并删除了其中已不存在的 21 个 key。

0.1.3 让本包跟上了 harness 0.1.6-alpha.1：新增 139 个 key 和 7 个新分区——`sidebarTerminal`（右侧边栏中的终端）、`settings.archivedSessions`（已归档会话）以及文档预览系列（`sidebarDocumentPreview`、`documentHtml`、`sidebarImage`、`documentMarkdown`、`sidebarPdf`）。此外还翻译了实验性的「自动检查」（`permission.access`：`auto.*`）、命令面板的标签与 token、模型设置中的端点字段，以及 `conversation`、`trajectory`、`chat`、`session-log-download` 中的变更。已从 harness 中消失的 28 个 key 已删除。

覆盖率检查基于 harness 的源码进行：对每个 namespace 比较 key 集合，因此下一个版本总是从一份精确的「新增 / 检查 / 删除」清单开始。

0.1.6 让本包跟上了 harness **0.1.7-rc.2**：新增 **252 个 key**，更新 18 个，删除 26 个，并新增两个 namespace。变更如下：

- **`shortcuts`**（新 namespace，56 个 key）——快捷键编辑器：录制组合键、冲突、保留组合、macOS 与 Windows 的提示、恢复默认值；
- **`schedule.manager`**（当时为 70 个 key）——自动化任务管理器：列表、删除、重复、运行历史、Cron 表达式。**当时错误地记录说 namespace `schedule.catalog` 就此被取消；0.1.7 已修正——两个 namespace 并存**；
- **`settings.account`**（50 个 key）——应用首次启动：欢迎语、选择用途与工作过程展示的详细程度、充值余额、在任务执行期间退出账号；
- 新增了运行中增删工具的标签（`message.tools*`、`trajectory.layout.*`）、右侧边栏命令（`sidebarRight`）、面板中的「请先选择会话」状态，并更新了设置分区名称：由 «Инструментов разработчика» 改为 «Инструменты для кода»；
- 18 个 key 按变更后的英文文本更新，26 个删除。有一处把 «рабочей области» 统一改为 «рабочая папка»。

0.1.5 让本包跟上了 harness **0.1.7-rc.1**：新增 **49 个 key**，更新 13 个，删除 16 个，移除了 namespace `directory-browser`（rc.1 中已不再有它）。新增了工具执行步骤的标签（`message.stepProcess.prepare.*` 和 `done.*`——读取图像、写入文件、准备代码搜索、网页搜索、子代理协同等）、全屏查看图像（`image.*`）、«Стандартный» 与 «Подробный» 两种过程展示模式、从 GitHub 安装插件（带超时与中国镜像）、插件版本不兼容警告、语音输入的模型下载源选择，以及 `Cordis` 命令的消息。还修订了 upstream 把 «teammate/agent» 改为 «subagent»、把 «Beta» 改为 «Experimental» 的那些措辞。

另外，0.1.5 修复了插件清单中的计数单位：原来是 «187 плагины»，现在是 «187 плагинов»。内置界面截图也已翻译，补充了 npm keywords，并修正了 `@deepseek-ai/dsh-client-locale` 的 peer 范围（`>=0.1.0-rc.2 <0.2.0`）——此前 `^0.1.0` 无法解析，因为该包只以 prerelease 版本发布。

0.1.4 让本包跟上了 harness **0.1.7-alpha.2**——这是跨度最大的一次：新增 **905 个 key**，修改 29 个，删除 126 个。新增分区：

- **`pluginManager`**——内置插件面板：安装、删除、启用与停用组件、版本、注册表以及安装提示；
- **`settings.account`**——DeepSeek 账号：登录、余额、消费、API 密钥；
- 原先的 `settings.plugins` 拆分成的几个独立设置分区：**`settings.agentLoop`**、**`settings.shell`**、**`settings.subagent`**、**`settings.webSearch`**；
- **`sidebarBrowser`**——右侧面板中的内置浏览器（地址、沙箱、恢复页面）；
- **`sidebarExcel`** 和 **`sidebarOffice`**——表格与 Office 文档的预览；PDF 和图像中新增了缩放（`zoom.*`）；
- **`voice-input`**——实验性语音输入。

此外还翻译了 `conversation`（+194）、`chat`（+53）、`workspace`（+43：会话归档、置顶）、`deliverables`（+31：过程变更概览）、`job`（+24：后台任务的实时输出）、`settings`（+22：桌面应用更新）、`plan`、`open-in-app`、`trajectory`、`model`、`reference`、`session-log-download` 中的新文本，以及代理模式指南中的文本（`settings.agentPreset`，12 段长文本）。`settings.archivedSessions` 分区已删除：0.1.7 中 upstream 去掉了这个包，会话归档迁移到了 `workspace`。

## 许可证

MIT

## 变更历史

[CHANGELOG.md](CHANGELOG.md)——每个版本都有什么。
