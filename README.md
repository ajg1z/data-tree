# data-tree

Монорепозиторий из двух пакетов для работы с древовидными данными: ядро движка и React-компонент с виртуализацией и плагинами.

## Пакеты

### @ajgiz/tree-core

Ядро движка: дерево узлов, состояние раскрытия/скрытия, колонки, формирование линейного представления (ViewState) и инкрементальные обновления при expand/collapse/visibility.

**Основное:**
- `TreeDataEngine` — класс движка с `initData()`, плагинами и опциями
- Публичный API: `getAPI().apply(operation)`, `getViewState()`, `getCoreState()`, `getOptions()`
- Операции: `add-node`, `remove-node`, `expand-node`, `collapse-node`, `toggle-expand`, `set-node-visibility`, `set-column-visibility`, `custom` (для плагинов)
- ViewState: `nodes` (LinearNode[]), `visibleNodesIndexes`, `columns`, `metadata`
- Плагины через `EnginePlugin` (init, onOperation, run) — могут менять metadata в пайплайне

**Установка и сборка:**
```bash
cd packages/tree-core
npm install
npm run build
npm test
```

---

### @ajgiz/tree-react

React-обёртка над tree-core: компонент таблицы-дерева с виртуализацией (react-virtuoso), регистром рендеров ячеек/колонок/строк и демо-плагинами.

**Основное:**
- `TreeDataList` — компонент списка по `visibleNodesIndexes`, с заголовками колонок и виртуализированным списком строк
- Пропсы: `initData`, `metadata` (expanded, hiddenNodes, …), `plugins`, `registry`, `options`, `height`, `classNames`
- `createDefaultRenderRegistry()` — ячейки (tree/cell, text), строка, заголовок колонки; можно переопределять через `registry`
- Хуки: `useTreeDataViewState(engine)`, `useScrolling`, `useAutoWidthCols`

**Демо-плагины** (в `demo/plugins`):
- **SortPlugin** — сортировка по колонке (custom op `set-sort`)
- **FilterPlugin** — фильтрация по предикату или по `options.filterQuery`
- **CheckablePlugin** — чекбоксы: состояние `check` / `uncheck` / `partial`, `autoParent`, распространение по детям и предкам

**Установка и запуск демо:**
```bash
cd packages/tree-react
npm install
npm run dev
```

Сборка библиотеки: `npm run build:lib`

---

## Зависимости

- **tree-react** зависит от **tree-core** (`@ajgiz/tree-core`)
- tree-core — только TypeScript, без React
- tree-react — React 18+, react-virtuoso

## Структура репозитория

```
packages/
  tree-core/     # движок, типы, ViewPipeline, viewData, тесты
  tree-react/    # TreeDataList, registry, хуки, demo + плагины
```

Корневой README описывает оба пакета; детали по API и использованию — в `packages/tree-core/Readme.md` и в коде пакетов.
