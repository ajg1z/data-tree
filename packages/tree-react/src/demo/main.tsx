import React, { useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { TreeDataList } from "../components/TreeDataList";
import './main.scss'

import type { CoreNode, CoreColumn, NodeId } from "@ajgiz/tree-core";

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

function App() {
  const exampleData = useMemo(() => createExampleData(), []);

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}>Пример TreeDataList</h1>
      <TreeDataList
        initData={useCallback(() => exampleData, [exampleData])}
        height={600}
        options={useMemo(() => ({ paddingLeft: 20 }), [])}
        metadata={useMemo(() => ({
          expanded: new Set(exampleData.rootIds),
        }), [exampleData])}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

