# Готово к отправке в каталог awesome-dsh-plugin

Каталог `awesome-dsh-plugin/awesome-dsh-plugin` — это список из 5786 плагинов, который
одновременно служит **индексом магазина**: на dsh 0.2.1+ пользователь добавляет
`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog...` как источник индекса и видит каталог
внутри GUI («Плагины → Обзор → Источники индекса»), а `dsh-market` ставит плагины в один
клик. У конкурента в каталоге **14 упоминаний**, у нас на момент проверки — **ноль**.

Подача — один YAML-файл в `data/plugins/<owner>__<repo>.yml`; README генерируется после merge.

## Файл 1 — языковой пакет

```
data/plugins/Ragnoryok1__dsh-client-locale-ru.yml
```

```yaml
url: https://github.com/Ragnoryok1/dsh-client-locale-ru
name: Ragnoryok1/dsh-client-locale-ru
category: ui
description:
  en: 'Russian (ru) language pack for the dsh web GUI: 287 namespaces and 48914 strings, including 223 third-party plugin dictionaries and ru plural forms.'
  zh: '为 dsh Web 界面提供俄语 (ru) 语言包：287 个命名空间、48914 条文案，含 223 个第三方插件词典与俄语复数形式。'
```

## Файл 2 — диагностика плагинов

```
data/plugins/Ragnoryok1__dsh-plugin-doctor.yml
```

```yaml
url: https://github.com/Ragnoryok1/dsh-plugin-doctor
name: Ragnoryok1/dsh-plugin-doctor
category: dev
description:
  en: 'Plugin diagnostics for the dsh web GUI: finds plugins that failed to load, bundle rows that never started and broken file links, then repairs the reversible ones with a journal and an undo.'
  zh: 'dsh Web 界面的插件诊断：找出加载失败的插件、未启动的 bundle 行与失效的 file 链接，并为可逆问题提供带日志与撤销的修复。'
```

Оба файла лежат рядом: `docs/catalog-entry.yml` и `docs/catalog-entry-doctor.yml`.

## Почему именно так

- **category: ui / dev** — языковые пакеты каталог относит к «UI Enhancements» (там же соседний
  `asd13006/dsh-multi-lang-ui`), диагностику — к `dev` (391 запись).
- **Описания в кавычках** — в обоих есть `: ` (двоеточие с пробелом); `contributing.md`
  предупреждает, что без кавычек YAML прочитает это как вложенный ключ.
- **Никаких превосходных степеней.** Правила: «описания говорят, что плагин делает — без
  суперлативов», и заявленное сверяется с кодом. 287 namespace, 48914 строк, 223 словарей — факты
  из `NAMESPACES.md` и `plugins/`; у doctor — из его README.

## Автоматические условия пройдены

| требование | locale-ru | plugin-doctor |
|---|---|---|
| `dsh.bundle` в манифесте | есть | есть |
| репозиторий старше 1 дня | создан 2026-09-03 | создан 2026-10-06 |
| тема `dsh-plugin` | проставлена | проставлена |
| `description.en` с точкой в конце | да | да |

## Чего в каталог отправить нельзя

`@ragnoryok1/dsh-client-theme-pack` — у него нет публичного репозитория (локальная папка без
remote) и он **не опубликован в npm**. Раздел `theme` в каталоге — 218 записей, и это ровно та
категория, где языковые пакеты не конкурируют. Чтобы попасть туда, нужно сначала опубликовать
пакет и создать репозиторий.

## Как отправить

1. Форк `awesome-dsh-plugin/awesome-dsh-plugin`.
2. Добавить оба файла из `docs/`.
3. Pull request. Ничего запускать не нужно: README пересобираются на `main` после merge.

Либо: дайте GitHub-токен с правом форка и PR — отправлю сам.
