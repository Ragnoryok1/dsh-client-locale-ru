<!-- deepseek-harness-meta
{
  "name": "Russian (ru) language pack for DeepSeek Harness",
  "version": "0.2.1",
  "tags": ["localization", "russian", "i18n", "web-gui", "language-pack"],
  "description": "Full Russian interface for the DeepSeek Harness web GUI: 64 namespaces, 3033 translated strings, Russian screen typography, and a locale audit in CI pinned to a harness tag. Includes the automation-task manager and the reminder catalog.",
  "icon": "https://raw.githubusercontent.com/Ragnoryok1/dsh-client-locale-ru/main/assets/icon.png",
  "compatible_versions": ["v0.2.1-rc.2", "v0.2.1-rc.1", "v0.2.1-alpha.5", "v0.2.1-alpha.4", "v0.2.1-alpha.3", "v0.2.1-alpha.2", "v0.2.1-alpha.1", "v0.2.0-rc.2", "v0.2.0-rc.1", "v0.1.7-rc.2", "v0.1.7-rc.1", "v0.1.7-alpha.2"],
  "screenshots": "images",
  "install_method": "dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru"
}
-->

# @ragnoryok1/dsh-client-locale-ru

[Русский](README.md) | [English](README.en.md) | **中文**

![DeepSeek Harness 俄语语言包](assets/banner.jpg)

[![npm](https://img.shields.io/npm/v/%40ragnoryok1%2Fdsh-client-locale-ru)](https://www.npmjs.com/package/@ragnoryok1/dsh-client-locale-ru)
[![license](https://img.shields.io/npm/l/%40ragnoryok1%2Fdsh-client-locale-ru)](LICENSE)
[![verify](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml/badge.svg)](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml)
[![dsh](https://img.shields.io/badge/dsh-0.2.1--rc.2%2B-6366f1)](https://github.com/deepseek-ai/deepseek-harness)
[![namespaces](https://img.shields.io/badge/namespaces-64-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)
[![strings](https://img.shields.io/badge/strings-3%2C033-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面（`dsh`）的俄语（`ru`）语言包。它通过 locale 服务（`ctx.locale.addLanguage`）把 `ru` 注册为可选的客户端语言，并为每个 namespace 提供一份词典——共 64 个 namespace、3,033 条翻译，基于 dsh `0.2.1-alpha.3` 构建。用 `dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru` 安装，然后在 Settings → General 中选择 **Русский**。缺失的 key 会回退到英文，因此更新的 harness 也能照常工作。覆盖范围仅限 harness 自带的客户端界面——第三方插件的词典有意不纳入范围，而下载量最高的 17 个生态插件中有 11 个不提供自己的字符串，所以它们通过这些 namespace 已经是俄语界面了。MIT 许可，由社区维护，与 DeepSeek 无隶属关系。

> **如果这个包对你有用，请给仓库点一颗 star。** 这是表明「有人需要这份翻译」的唯一信号，它也决定了接下来优先做哪些部分。

---

完整清单见 [NAMESPACES.md](NAMESPACES.md)：64 个 namespace、3033 条字符串，随包附带的插件词典单独标注。

## 效果展示

语言列表中的俄语，以及已翻译的设置分区（截图截取自 `0.1.8` 构建：同一屏幕，但此后措辞和部分分区已有变化——例如字号说明现在写作 «Влияет только на содержимое диалога»）：

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

清单按 harness 自身的规则检查，而不是靠肉眼（`npm run check:manifest`，包含在 `verify` 中）。每一条规则都取自 harness 源码，每一条都对应一种否则会先落到用户头上的失败：`parseDshClient` 接受任意字符串作为 `platform`，但消费方只保留 `platform === 'web'` 的行，因此写成 `'Web'` 这样的笔误会**悄悄关掉**客户端那一半；声明了 `dsh.client` 却没有 `./client` 导出会让 `client-modules` 抛错；`dsh.bundle.patch` 必须指向确实存在的文件。

从 GitHub 安装同样可用：`dsh plugin --profile web add Ragnoryok1/dsh-client-locale-ru`（插件目录生成的就是这种不带 npm scope 的写法）安装的是仓库归档，而构建好的 `lib/` 已提交进 git——你的机器上不会运行构建，也不需要运行。正因如此，`npm run check:built`（包含在 `verify` 中）会重新构建 `lib/` 并与提交内容比对：git 里过期的构建产物会直接落到用户手里，而审计看不到它——审计读的是源码。发布的包为 410 KB：横幅以 JPEG 提供，图标与源码映射不进入 npm 包。

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

## 检查

```sh
npm run build             # сборка трёх выходов
npm run check:typography  # 18 правил типографики, включая «не трогать»
npm run check:locale      # сосуществование словарей: 6 проверок
npm run check:plural      # формы числа: 1 вызов / 2 вызова / 5 вызовов
npm run check:composition # собранные фразы: «Пн, Ср в 09:00», «Раз в 2 дня»
npm run audit -- <дерево харнеса>   # аудит локали
npm run verify -- <дерево харнеса>  # всё вместе
```

另有一项检查按 harness 的方式把短语拼起来，再整句阅读。审计只把取值与它自己的模板比对，因此「单独看正确、被替换后就错了」的句子它看不见：`frequency.weekly` 曾填成 «По {weekdays} в {time}»，而星期是 «Пн, Ср»——得到 «По Пн, Ср в 09:00»，任何逐值检查都发现不了。同样被钉住的还有 «Каждые 2 дня»（现为 «Раз в 2 дня»）、«Каждый день в 09:00 (Europe/Moscow)»，以及带复数形式的组合间隔。同一种方式还找出了第三处：`time.locale` 不是文案，而是给 `Intl` 的语言标签，它的取值曾是 `en`——限制到某个月的规则显示成 «Каждый день в January»，俄语界面里的时区标签是 «Moscow Standard Time»。现在是 `ru`（harness 的中文词典同样用 `zh-CN`），月份放在括号里：«Каждый день (январь, март)»。

同样按部分拆读还发现了 cron 描述的写法问题：缩写（«Каждые {step} мин»、«Каждые {count} ч»）和书卷气的表达（«в минуту {minutes}»、«минуты {minutes} в часы {hours}»）。带计数的部分补上了复数形式——«Каждые 3 минуты» / «Каждые 5 минут»、«Каждые 2 часа» / «Каждые 6 часов»——其余改写成统一的带标注写法：«Каждый час, минуты: 5, 30»、«минуты: 5, часы: 09–17»。整句日程描述也整句断言：«Пн–Пт каждые 5 минут»。日期同样被钉住：«5 окт. 2026 г., 15:51» 与时区标签 «Москва, стандартное время» 都由 Intl 用我们的标签生成，不含任何拉丁词。

审计在 CI（`.github/workflows/verify.yml`）中针对**锁定的 harness 标签**运行，而不是针对随便一份本地 checkout。同一次运行还会**每周按计划**触发一次：即使没人改动，译文也会腐坏——上游继续前进，本地一切正常，而偏差只在用户构建时才浮现。门禁覆盖完整性（key 与 namespace）、复数形式、占位符、英文与中文残留、术语、正文中的拉丁词、文本卫生、首尾空格、风格、取值的排版、«ё»、组合短语以及对外宣称的数字——每一项都已经抓到过真实缺陷。除此之外，审计还会打印**参考报告**——它们不是门禁，因为需要人来判断：比对了多少个 namespace、哪些无法建立对应关系、是否还留有「数字 + 需变格的名词」，以及短字符串是否长到英文的 2.8 倍以上（排版风险——«Effort» → «Уровень рассуждения» 是俄语的正常长度，不是缺陷）。

审计按 harness 实际书写的形式读取模板：字符串、**段落数组**（各模式的指南就是这样存储的）以及**常量引用**（`'hint.plan': PLAN_NEXT_ACTION_EN`）。在只读取第一种形式时，有十个 key——其中八个是整篇指南——悄悄退出了所有比对。反过来也一样：空的策略文件（`keep-english.json`、`terminology.json` 的某个分区）现在会让审计失败，而不是在无人察觉的情况下放宽门禁。README 中宣称的数字也按同样方式与包体核对，因为过期的数字就是错误的说法——同样的数字还会从 `package.json` 的 description 中读取，那是 npm 在搜索与包页面上显示的内容（「55 namespaces」正是在那里活得最久）——包括带千位分隔符的写法：旧版开头写的是 `2 489`，而检查此前只读取不带分隔符的形式，所以数字模式现在也接受千位分隔符。紧随其后还核对「针对哪个 harness 版本构建」这句话：它必须与 workflow 中锁定的标签一致，因为真正验证这个包的是那个 workflow（两个 README 的开头都还写着 `0.2.1-alpha.2`，而 CI 早已换成 `dsh-v0.2.1-rc.2`）。发布包的体积也在这里实测：`npm run check:size` 会打包归档，并把声明的千字节数与实际值对比（允许 1 KB 误差——不同 Node 构建下的 gzip 压缩结果略有差别，而这句话本身也只精确到整千字节）。

- **无效 namespace**——包注册的每一个 namespace 都必须在 harness 中存在。在 0.1.6 中，日程目录的翻译被注册在 `schedule.manager` 名下，而读取它们的是 `schedule.catalog`：此时按 key 做的覆盖率检查还报告「全部已翻译」；
- **复数形式配对**——`.one`/`.other` 的集合必须一致，因为客户端按 `count === 1 ? '.one' : '.other'` 选择形式。这对俄语还不够：每一对还需要 `.few` 与 `.many`，否则包装层会悄悄退回中性的 `.other`，本该是 «2 дня» 的地方显示成 «2 д»。该检查**按 namespace** 进行——包装层在提问的那个 namespace 里查找形式，因此「某个界面上有、另一个界面上缺」这种情况否则不会被发现。它找到了四个时间单位（`schedule.catalog` 中的 `unit.day/hour/minute/second`）和任务管理器里的 `trigger`；同时这些单位不再是缩写（«д»、«ч»、«мин»），而是带正确格位的完整形式——«через 2 дня»、«через 5 часов»，而 «Каждые 2 дня» 现在写作 «Раз в 2 дня»。同样的要求也覆盖本包自己添加的 key（`terminal.expand` 及其同类：harness 会把计数传给它，却从不配对）——这些形式只由我们维护，少一个不会有任何其他检查发现；
- **占位符**——俄语值必须携带与英文模板完全相同的 `{name}`：多出的占位符会原样出现在界面上（`Заняло {duration}7мин 26с`，已在 #2 修复），缺失的则会让插值内容悄悄消失。对于只提供中文词典的包，模板以 `zh` 为准。我们**自己添加的复数形式**——补充的 `.few`/`.many`，以及 harness 从未配对的 key 上的 `.one`——在上游并不存在，因此改为与同一词相邻形式（`.one`/`.other`）或该 key 本身的模板比对。没有这条规则时，有 52 个取值从未被检查过：`{count}` 正是可能从某个形式里丢失，让句子少了数字。
- **残留**——取值必须是俄语：与英文模板完全相同的副本、残留的中文字符，或模板有文本而取值为空，都是缺陷。只有记录在 `scripts/keep-english.json` 中的决定才允许保留英文（地址、无文字的格式串、协议与工具名称、缩写），因此新出现的未翻译字符串无法悄悄通过。这些决定本身也会被检查：已经不再排除任何东西的条目同样会让构建失败——要么包里已经没有这个 key，要么取值已经翻译、决定随之作废。`deepSeekBaseUrl` 正是这样被发现的：英文模板多了一句关于 `DEEPSEEK_BASE_URL` 的说明，而输入框的占位符必须是纯示例地址，把说明塞进输入框只会变成噪音。条目已删除，取值保留。决定也可以覆盖一个封闭列表：`chat · app.*` 用一行允许三十个应用名——应用名词典本身就是一份名单。而占位符之外没有词的值（`{from}–{to}`、`{percent}%`、`, `）根本不需要决定：里面没有可翻译的内容，策略因此只谈词，不谈标点。残留检查现在读取 key 的**全部**模板，而不只是 `en` 块：以前有 60 个取值落在未被识别的词典块里、完全没有被检查；现在比对 2911 个取值，其中 68 个由决定覆盖（38 条记录，其中一条是模式），这个盲区作为一类已经消失。规则并没有因此变宽：只有当没有任何模板为空时，空取值为缺陷——否则俄语正当地省略英文同样省略的前缀（`message.stepProcess.sharedPrefix`）。而精确相等也不是唯一的副本：与模板仅相差大小写或首尾空格的取值（模板 `cancel` 而取值为 `Cancel`）同样是未翻译的文本，同样需要决定——否则这样的行会以英文显示，而所有检查却都是绿的。
- **失效 key**——既不在任何 harness 词典中、也没有任何 harness 源码引用的 key，是旧版本留下的残余：它什么也不显示，只会误导。这类 key 会让构建失败。组件仍会请求的 key 只出现在参考报告中，因为真正显示在界面上的是我们提供的值。
- **术语**——一个概念只有一种译法。被禁用的变体（«кеш» 而非 «кэш»、«сеанс» 而非 «сессия»、«этап» 而非 «шаг»）会让构建失败；`scripts/terminology.json` 同时保存决定与所选形式的计数，因此漂移在变成缺陷之前就能看到。该检查立刻发现 `confirm.description` 在两个 namespace 下被译成两种写法——«шаги» 和 «этапы»。同一个词也不能既带 «ё» 又不带：同一个包里同时出现 «ещё» 和 «еще» 读起来就是机器翻译，因此检查会把 «ё» 折叠成 «е»，同一种折叠形式出现两种写法就让构建失败。真正不同的词（如 «все» 与 «всё»）在 `scripts/yo-pairs.json` 中声明；声明里的写法若已从包中消失，同样让构建失败。同一份检查也覆盖俄语短语中的拉丁词：产品名、命令名或代码记号可以保留，句子里的普通英文单词则不行。此外还检查机械性文本卫生：连续空格、标点前的空格、不成对的 «ёлочки» 与括号、取值内部的不断行空格，以及首尾空格——以空格开头或结尾的取值会被组件与相邻内容拼接，因此必须与所属 namespace 的英文模板一致。同一个模板还用来核对风格：英文结尾有的标点，俄语不能丢掉（该检查正是这样发现 `registryCustomHint` 少了句点）；首字母大小写也必须一致——但 `JSON` 这类缩写，以及以占位符开头的模板除外。对读者的称呼单独检查：句子内部俄语界面写作小写 «вы»，而大写的 «Вы» 只出现在句首，那里只是普通的正字法。最后，本包还会与自身比对：同一句英文只能对应一句俄文。若两个 namespace 给出不同的俄文句子（只比较四个词以上的模板——短标签合法地取决于上下文），构建即失败。`confirm.description` 正是这样被发现的：一种写法承诺 «пропускать шаги подтверждения»，另一种写作 «уменьшать число шагов»，而英文的 «subsequent tasks» 在后者里变成了 «текущей задаче»。有意的差异需要在 `scripts/one-rendering.json` 中连同理由一起声明；已经不再排除任何东西的例外同样会让构建失败，否则这份决定清单会悄悄放宽检查。反方向只作参考输出：同一个俄语答案对应**不同**的英文句子（四个词以上）往往是复制粘贴的痕迹——提示从相邻 key 串了过来，或两件不同的事被并成一句。它不能作为门禁，因为俄语正当地合并英文分开的词，所以两侧会并排打印，由人来判断。

标签的新旧由单独的 workflow 盯守：`watch-upstream` 每周把锁定的标签与 harness 的标签比对一次，出现更新的标签就开一个 issue（内含操作步骤）并把运行标红——让「落后」按计划被发现，而不是靠用户的截图。版本比较无需网络即可验证（`npm run check:upstream`，五个用例），并且纳入 `verify`：正式版本必须比自己的预发布版本更新，否则盯守会永远报警。

覆盖率数字不是门禁：有些分区是有意保留英文的。紧随其后，审计会打印**按 namespace** 的报告：它根据注册方重建「namespace → 词典」的对应关系（`NS` 声明，或 `locale.register` 里的字面量；`bind` 与 `PropsLocale` 只是读取 namespace），并列出既不在自己 namespace、也不在运行时回退所用的 `common` 词典中的 key。全局比较 key 名称看不到这类空洞：放在别的 namespace 下的翻译会被算作已覆盖，而那个界面实际显示英文。该报告仅供参考——同名 key 在不同 namespace 下含义可能不同（`list.aria` 在提醒目录里是「活动提醒」，在任务里是「后台任务」），因此只有在两个 namespace 由同一份词典提供服务时才会跨 namespace 搬运翻译。在锁定的标签上，该报告为空：harness 在我们注册的 namespace 里渲染的每一条字符串，都位于该 namespace。本包的全部 64 个 namespace 都会被比对——对应关系既来自紧邻注册处的词典导入，也来自注册语句本身传入的名称（`locale.register(NS, { zh, en })`）；若没有第二条规则，词典位于相邻目录的 `common` 与 `settings.locale` 就会落在检查之外。反方向是硬失败而不是参考报告：harness 注册并填充了 key、而本包从不注册的 namespace，会让那个界面停留在英文，而按 key 名称统计的覆盖率看起来依然完整。`settings.sessionLog` 正是这样被发现的——通用设置页上的「上传 Session Log」开关。

## 覆盖范围：仅官方界面

本包翻译的是 **harness 客户端自有的 namespace**——共 64 个 namespace，已与锁定标签核对。第三方插件的词典有意不在范围内，原因如下。

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
3. 排版（18 条规则）；
4. 针对锁定 harness 标签的本地化审计——无效 namespace、重复项、复数形式配对和占位符不一致会报错并中止发布；
5. **与 `compatible_versions` 中每个版本的兼容性**：从 npm 下载该版本的 locale 运行时，并对它运行语言共存与复数形式两套测试（`npm run check:compat`）——meta 块里的承诺是被验证的，而不是被假定的。

声明本身也单独检查（`npm run check:peers`，包含在 `verify` 中）：harness 并不把我们对 `@deepseek-ai/dsh*` 的 `peerDependencies` 当作包的版本，而是当作**运行时版本**的范围，并带上 `includePrerelease`；若该范围不满足正在运行的 dsh，用户就会看到不兼容警告与豁免提示。脚本把这条 harness 规则套用到所有被声明的版本上——目前八个都通过。

在本地做完全相同的检查，但不发布：

```
npm run verify -- путь/к/дереву/харнесса
```

该 workflow 还支持手动触发，并带有「只检查、不发布」的开关（`workflow_dispatch` → `dry-run`）。

## 内容

- `src/client/dicts.ts`——俄语词典（64 个 namespace、3033 条翻译、约 3000 行）。这正是本包的核心价值。
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
