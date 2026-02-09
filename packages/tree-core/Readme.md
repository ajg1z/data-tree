# @ajgiz/tree-core

Ядро движка для древовидных данных: модель узлов, раскрытие/скрытие, видимость колонок, формирование линейного представления (ViewState) и инкрементальные обновления. Без UI — только типы и логика.

## Установка

```bash
npm i @ajgiz/tree-core
```

## Создание движка

```ts
import { TreeDataEngine } from '@ajgiz/tree-core'

const engine = new TreeDataEngine({
  initData: () => ({
    nodeMap: new Map(),
    rootIds: new Set(),
    columns: [],
  }),
  options: { paddingLeft: 20 },
  metadata: { expanded: new Set(), hiddenNodes: new Set(), hiddenColumns: new Set(), disabledNodes: new Set() },
  plugins: [],
  createNode: undefined,
  buildCells: undefined,
  createViewColumns: undefined,
  buildLinearNodes: undefined,
})
```

- **initData()** — возвращает `nodeMap`, `rootIds` (Set), `columns`. Узлы: `CoreNode` (id, parent, children, value, depth).
- **metadata** — начальные множества expanded, hiddenNodes, hiddenColumns, disabledNodes.
- **plugins** — массив `EnginePlugin` (init, onOperation, run).
- **options** — произвольный объект, доступен через `getOptions()` (например для плагинов).

## Публичный API

| Метод | Описание |
|-------|----------|
| `getAPI()` | `{ apply(op), getPluginState(id) }` — применение операций и доступ к состоянию плагинов |
| `getViewState()` | Текущее представление: `nodes`, `visibleNodesIndexes`, `columns`, `metadata`, `options` |
| `getCoreState()` | Ядро: `nodeMap`, `rootIds`, `columns` |
| `getOptions()` | Текущие опции движка |
| `subscribe(fn)` | Подписка на обновления (после apply) |
| `updateOptions(opts)` | Обновить опции |
| `setMetadata(metadata)` | Обновить expanded / hiddenNodes / hiddenColumns / disabledNodes |

## Операции (apply)

- **add-node** — добавить узел (payload: `parentId?`, `node: { id, value }`).
- **remove-node** — удалить узел и поддерево (payload: `id`).
- **expand-node** / **collapse-node** / **toggle-expand** — раскрытие/сворачивание (payload: `id`).
- **set-node-visibility** — скрыть/показать узел (payload: `id`, `visible`).
- **set-column-visibility** — видимость колонки (payload: `index`, `id`, `visible`).
- **set-columns-visibility** — все колонки (payload: `visible`).
- **set-column-width** / **set-columns-width** — ширина колонок.
- **update-options** — обновить опции (payload: `options`).
- **set-metadata** — обновить metadata (payload: `metadata`).
- **custom** — произвольная операция для плагинов (payload: `type`, `data`).

## ViewState и LinearNode

`getViewState()` возвращает:

- **nodes** — массив `LinearNode` в порядке обхода дерева (depth-first). У каждого: `id`, `depth`, `hasChildren`, `expanded`, `visible`, `index`, `subtreeSize`, `cells`, `disabled`.
- **visibleNodesIndexes** — индексы в `nodes` видимых строк (учёт expanded и hiddenNodes).
- **columns** — видимые колонки (с учётом hiddenColumns).
- **metadata** — текущие expanded, hiddenNodes, hiddenColumns, disabledNodes, nodeMap, rootIds, columns.
- **options** — опции представления.

Скрытые колонки не попадают в `columns` и не дают ячеек в `cells`. Первая видимая ячейка — обычно `tree/cell`, остальные — `text` (можно переопределить через `buildCells`).

## Плагины (EnginePlugin)

- **id** — уникальный идентификатор.
- **init(engine)** — инициализация, вызов `engine.initPluginState(id, state)`.
- **onOperation(op, engine)** — реакция на любую операцию (в т.ч. `custom`).
- **run(ctx, engine)** — участие в пайплайне представления: получает `metadata`, возвращает `{ data: ViewMetadata, isUpdated }`. Плагины вызываются по порядку; можно менять `nodeMap`, `rootIds` (сортировка, фильтрация).

Плагины не мокают в тестах; тесты движка используют только публичный API.

## Сборка и тесты

```bash
npm run build
npm test
```

Тесты: Vitest, `TreeDataEngine.test.ts` — операции, ViewState, linearNodes, инкрементальные обновления, колонки и граничные случаи.
