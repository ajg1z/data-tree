import React, { useCallback, useMemo, useState, useEffect, useDeferredValue } from "react";
import ReactDOM from "react-dom/client";
import { TreeDataList } from "../components/TreeDataList";
import { createDefaultRenderRegistry } from "../registry/RenderRegistry";
import "./main.scss";

import type { CoreNode, CoreColumn, NodeId, EngineAPI } from "@ajgiz/tree-core";
import { SortPlugin } from "./plugins/SortPlugin";
import { FilterPlugin } from "./plugins";
import type { ColumnRenderFn, RenderRegistry } from "../types";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function createExampleData() {
  const nodeMap = new Map<NodeId, CoreNode>();
  const rootIds = new Set<NodeId>();
  const columns: CoreColumn[] = [
    { id: "name", text: "Название", width: 200 },
    { id: "type", text: "Тип", width: 150 },
    { id: "size", text: "Размер", width: 100 },
    { id: "date", text: "Дата", width: 120 },
  ];

  let nodeIdCounter = 1;

  const createNode = (
    parentId: NodeId | null,
    name: string,
    type: string,
    size: string,
    date: string,
    depth: number,
    hasChildren: boolean = false
  ): NodeId => {
    const id = `node-${nodeIdCounter++}`;
    const children = new Set<NodeId>();

    nodeMap.set(id, {
      id,
      parent: parentId,
      children,
      value: [name, type, size, date],
      depth,
    });

    if (parentId) {
      const parent = nodeMap.get(parentId);
      if (parent) {
        parent.children.add(id);
      }
    } else {
      rootIds.add(id);
    }

    return id;
  };

  const root1 = createNode(null, "Документы", "Папка", "—", "2024-01-15", 0, true);
  const doc1 = createNode(root1, "Отчеты", "Папка", "—", "2024-01-20", 1, true);
  createNode(doc1, "Отчет Q1.pdf", "PDF", "2.3 MB", "2024-01-25", 2);
  createNode(doc1, "Отчет Q2.pdf", "PDF", "2.8 MB", "2024-04-25", 2);
  createNode(doc1, "Отчет Q3.pdf", "PDF", "3.1 MB", "2024-07-25", 2);
  const doc2 = createNode(root1, "Презентации", "Папка", "—", "2024-02-10", 1, true);
  createNode(doc2, "Презентация 1.pptx", "PPTX", "5.2 MB", "2024-02-15", 2);
  createNode(doc2, "Презентация 2.pptx", "PPTX", "4.8 MB", "2024-03-20", 2);
  createNode(root1, "Заметки.txt", "TXT", "15 KB", "2024-01-18", 1);

  const root2 = createNode(null, "Изображения", "Папка", "—", "2024-02-01", 0, true);
  const img1 = createNode(root2, "Фото 2024", "Папка", "—", "2024-02-05", 1, true);
  createNode(img1, "IMG_001.jpg", "JPG", "3.5 MB", "2024-02-10", 2);
  createNode(img1, "IMG_002.jpg", "JPG", "4.1 MB", "2024-02-11", 2);
  createNode(img1, "IMG_003.jpg", "JPG", "3.8 MB", "2024-02-12", 2);
  const img2 = createNode(root2, "Скриншоты", "Папка", "—", "2024-03-01", 1, true);
  createNode(img2, "Screenshot_001.png", "PNG", "1.2 MB", "2024-03-05", 2);
  createNode(img2, "Screenshot_002.png", "PNG", "980 KB", "2024-03-06", 2);

  const root3 = createNode(null, "Проекты", "Папка", "—", "2024-01-10", 0, true);
  const proj1 = createNode(root3, "Проект Alpha", "Папка", "—", "2024-01-12", 1, true);
  const proj1Src = createNode(proj1, "src", "Папка", "—", "2024-01-13", 2, true);
  createNode(proj1Src, "index.ts", "TS", "2.5 KB", "2024-01-14", 3);
  createNode(proj1Src, "utils.ts", "TS", "5.1 KB", "2024-01-15", 3);
  createNode(proj1Src, "types.ts", "TS", "3.2 KB", "2024-01-16", 3);
  const proj1Tests = createNode(proj1, "tests", "Папка", "—", "2024-01-17", 2, true);
  createNode(proj1Tests, "index.test.ts", "TS", "4.3 KB", "2024-01-18", 3);
  createNode(proj1Tests, "utils.test.ts", "TS", "6.2 KB", "2024-01-19", 3);
  createNode(proj1, "package.json", "JSON", "1.1 KB", "2024-01-20", 2);
  createNode(proj1, "README.md", "MD", "2.8 KB", "2024-01-21", 2);

  const proj2 = createNode(root3, "Проект Beta", "Папка", "—", "2024-02-01", 1, true);
  const proj2Src = createNode(proj2, "src", "Папка", "—", "2024-02-02", 2, true);
  createNode(proj2Src, "main.ts", "TS", "3.4 KB", "2024-02-03", 3);
  createNode(proj2Src, "config.ts", "TS", "2.1 KB", "2024-02-04", 3);
  createNode(proj2, "tsconfig.json", "JSON", "800 B", "2024-02-05", 2);

  const root4 = createNode(null, "Музыка", "Папка", "—", "2024-03-01", 0, true);
  const music1 = createNode(root4, "Альбом 1", "Папка", "—", "2024-03-05", 1, true);
  createNode(music1, "Трек 01.mp3", "MP3", "4.2 MB", "2024-03-10", 2);
  createNode(music1, "Трек 02.mp3", "MP3", "3.9 MB", "2024-03-11", 2);
  createNode(music1, "Трек 03.mp3", "MP3", "4.5 MB", "2024-03-12", 2);
  createNode(music1, "Трек 04.mp3", "MP3", "4.1 MB", "2024-03-13", 2);

  const root5 = createNode(null, "Видео", "Папка", "—", "2024-04-01", 0, true);
  createNode(root5, "Видео 1.mp4", "MP4", "125 MB", "2024-04-05", 1);
  createNode(root5, "Видео 2.mp4", "MP4", "98 MB", "2024-04-06", 1);
  createNode(root5, "Видео 3.mp4", "MP4", "156 MB", "2024-04-07", 1);

  return { nodeMap, rootIds, columns };
}

const columnHeaderStyle = {
  display: "flex",
  alignItems: "center",
  fontWeight: 600,
  color: "#333",
  borderRight: "1px solid #ddd",
  backgroundColor: "#f5f5f5",
  padding: "4px 0px",
};

const ColumnWithSort: ColumnRenderFn = ({ column, ctx }) => (
  <div
    role="button"
    tabIndex={0}
    style={{
      ...columnHeaderStyle,
      width: column.width,
      maxWidth: column.width,
      minWidth: column.width,
      cursor: "pointer",
    }}
    onClick={() =>
      ctx.api.apply({
        type: "custom",
        payload: {
          type: "set-sort",
          data: { activeColumnIndex: ctx.index },
        },
      })
    }
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ctx.api.apply({
          type: "custom",
          payload: {
            type: "set-sort",
            data: { activeColumnIndex: ctx.index },
          },
        });
      }
    }}
  >
    <span>{column.text}</span>
    <span style={{ marginLeft: 4, opacity: 0.7 }}>⇅</span>
  </div>
);

function App() {
  const exampleData = useMemo(() => createExampleData(), []);
  const [search, setSearch] = useState("");
  const [api, setApi] = useState<EngineAPI | null>(null);
  const debouncedSearch = useDeferredValue(search);

  useEffect(() => {
    if (api) {
      api?.apply({
        type: 'custom',
        payload: {
          type: 'set-filter',
          data: { filterQuery: debouncedSearch },
        },
      });
    }
  }, [debouncedSearch]);

  const registry = useMemo<RenderRegistry<Record<string, any>>>(() => {
    return {
      column: new Map([["default", ColumnWithSort]]),
    };
  }, []);

  const plugins = useMemo(() => [new FilterPlugin(), new SortPlugin()], []);

  const options = useMemo(
    () => ({ paddingLeft: 20 }),
    []
  );

  const initData = useCallback(() => exampleData, [exampleData]);

  const metadata = useMemo(
    () => ({ expanded: new Set(exampleData.rootIds) }),
    [exampleData]
  );

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}>Пример TreeDataList</h1>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}
      >
        <label htmlFor="search">Поиск</label>
        <input
          id="search"
          type="search"
          placeholder="Поиск по дереву (с debounce 300ms)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "6px 10px", minWidth: 260 }}
        />
      </form>

      <TreeDataList
        registry={registry}
        initData={initData}
        height={600}
        getApi={useCallback((api) => {
          setApi(api);
        }, [])}
        plugins={plugins}
        options={options}
        metadata={metadata}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
