<!-- Сгенерировано `npm run namespaces`; проверяется `npm run check:namespaces`. -->
# Что переведено

Пакет переводит **собственные namespace клиента харнесса** — 64 namespace,
3033 строк. Колонка «как это выглядит» берёт заголовок самого namespace (то, что читает
пользователь), а не отдельное описание: список нельзя разойтись с переводами.

Строки с пометкой «плагин» — словари сторонних плагинов, которые пакет поставляет сам: харнесс их
не объявляет, поэтому они и вынесены в отдельную группу (`scripts/plugin-namespaces.json`).
Систематически чужие плагины в охват не входят: плагин приносит свои строки сам, и его русский
текст — его ответственность.

| namespace | как это выглядит | строк |
|---|---|---|
| `agent-team` (плагин) | Команда агентов | 25 |
| `approval` | — | 5 |
| `chat` | — | 200 |
| `claude-code-mods` (плагин) | — | 4 |
| `command` | — | 28 |
| `common` | — | 41 |
| `conversation` | — | 379 |
| `cordis` | — | 51 |
| `cotTranslation` | — | 32 |
| `deepseek-model-label-1017` (плагин) | — | 1 |
| `deliverables` | — | 60 |
| `documentHtml` | HTML | 4 |
| `documentMarkdown` | — | 4 |
| `feedback` | — | 20 |
| `goal` | — | 12 |
| `inspectorPanel` | Инспектор Node.js | 4 |
| `job` | — | 50 |
| `model` | — | 23 |
| `open-in-app` (плагин) | — | 45 |
| `permission.access` | Права доступа | 20 |
| `plan` | — | 17 |
| `pluginManager` | Плагины | 227 |
| `pluginMarket` | Обзор плагинов | 78 |
| `question` | — | 31 |
| `reference` | — | 15 |
| `schedule.catalog` | — | 90 |
| `schedule.manager` | Задачи автоматизации | 207 |
| `secretMask` | — | 2 |
| `session-inspector` (плагин) | — | 52 |
| `session-log-download` (плагин) | — | 10 |
| `settings` | Настройки | 41 |
| `settings.account` | Учётная запись | 94 |
| `settings.agentLoop` | Цикл агента | 12 |
| `settings.agentPreset` | Пресеты агента | 47 |
| `settings.locale` | — | 1 |
| `settings.models` | Модели | 134 |
| `settings.permission` | Права доступа | 20 |
| `settings.pluginInventory` | — | 37 |
| `settings.plugins` | Встроенные плагины | 5 |
| `settings.sessionLog` | — | 4 |
| `settings.shell` | Командная оболочка | 14 |
| `settings.subagent` | — | 35 |
| `settings.theme` | — | 25 |
| `settings.webSearch` | Веб-поиск | 27 |
| `shortcuts` | Горячие клавиши | 56 |
| `shortcuts.layout` | — | 1 |
| `sidebar` | — | 5 |
| `sidebarBrowser` | — | 26 |
| `sidebarCodePreview` | Код | 3 |
| `sidebarDocumentPreview` | — | 22 |
| `sidebarExcel` | Таблица | 15 |
| `sidebarFiles` | — | 17 |
| `sidebarImage` | Изображение | 11 |
| `sidebarOffice` | Документ Office | 15 |
| `sidebarPdf` | PDF | 15 |
| `sidebarRight` | — | 34 |
| `sidebarTerminal` | Терминал | 28 |
| `skill` | — | 8 |
| `slash.menu` | — | 9 |
| `subagent` | — | 79 |
| `trajectory` | — | 196 |
| `voice-input` (плагин) | — | 109 |
| `workflowRun` | — | 20 |
| `workspace` | — | 131 |

Итого: **64** namespace, **3033** строк; из них словарей плагинов —
7.
