import type {
  CoreColumn,
  EngineAPI,
  EnginePlugin,
  EngineState,
  NodeId,
  Operation,
  RebuildViewStateEffect,
  ViewColumn,
  ViewState,
  LinearNode,
  TreeDataEngineOptions,
} from './types'

import { ViewPipeline } from './ViewPipeline'
import { FenwickTree } from './fenwickTree'
import { buildCells, buildLinearNodes, createViewColumns } from './viewData'

export class TreeDataEngine<Opts extends Record<string, any> = Record<string, any>, Metadata extends Record<string, any> = Record<string, any>> {
  private state: EngineState

  private plugins: EnginePlugin[] = []

  private listeners = new Set<() => void>()

  private options: Opts = {} as Opts

  private api: EngineAPI

  private createNode?: TreeDataEngineOptions<Opts, Metadata>['createNode']
  private buildCells?: TreeDataEngineOptions<Opts, Metadata>['buildCells']
  private createViewColumns?: TreeDataEngineOptions<Opts, Metadata>['createViewColumns']
  private buildLinearNodes?: TreeDataEngineOptions<Opts, Metadata>['buildLinearNodes']

  private viewColumnsDirty = true
  private cacheViewColumns: ViewColumn[] | null = null

  private viewPipeline = new ViewPipeline()

  private visibleFenwick: FenwickTree = new FenwickTree(0)

  private expanded = new Set<NodeId>()
  private hiddenNodes = new Set<NodeId>();
  private hiddenColumns = new Set<number>();
  private disabledNodes = new Set<NodeId>();

  private linearNodes: LinearNode[] = []
  private linearIndex = new Map<NodeId, LinearNode>()
  private visibleNodesIndexes: number[] = []

  constructor(options: TreeDataEngineOptions<Opts, Metadata>) {
    this.createNode = options.createNode
    this.buildCells = options.buildCells ?? buildCells
    this.createViewColumns = options.createViewColumns ?? createViewColumns
    this.buildLinearNodes = options.buildLinearNodes ?? buildLinearNodes

    this.options = options.options ?? {} as Opts
    this.expanded = options.metadata?.expanded ?? new Set();
    this.hiddenNodes = options.metadata?.hiddenNodes ?? new Set();
    this.hiddenColumns = options.metadata?.hiddenColumns ?? new Set();
    this.disabledNodes = options.metadata?.disabledNodes ?? new Set();

    const { nodeMap, rootIds, columns } = options.initData()

    this.state = {
      core: { nodeMap, rootIds, columns },
      plugins: new Map(),
      viewState: null,
      viewDirty: true,
    }

    this.plugins = options.plugins ?? []

    this.api = {
      apply: (op: Operation) => this.applyOperation(op),
      getPluginState: <T>(pluginId: string): T => this.getPluginState<T>(pluginId),
    }

    this.plugins.forEach((plugin) => {
      plugin.init?.(this)
    })
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getLinerNodes(): { linearNodes: LinearNode[], visibleNodesIndexes: number[], linearIndex: Map<NodeId, LinearNode> } {
    return {
      linearNodes: this.linearNodes,
      visibleNodesIndexes: this.visibleNodesIndexes,
      linearIndex: this.linearIndex,
    }
  }

  getViewState(): ViewState<Metadata> | null {
    this.rebuildViewState()
    return this.state.viewState as ViewState<Metadata> | null
  }

  updateOptions(options: Opts): void {
    this.options = options
  }

  setMetadata(metadata: {
    expanded?: Set<NodeId>
    hiddenColumns?: Set<number>
    hiddenNodes?: Set<NodeId>
    disabledNodes?: Set<NodeId>
  }): void {
    if (metadata.expanded) {
      this.expanded = metadata.expanded
    }
    if (metadata.hiddenNodes) {
      this.hiddenNodes = metadata.hiddenNodes
    }
    if (metadata.hiddenColumns) {
      this.hiddenColumns = metadata.hiddenColumns
    }
    if (metadata.disabledNodes) {
      this.disabledNodes = metadata.disabledNodes
    }
  }

  getAPI(): EngineAPI {
    return this.api
  }

  getCoreState() {
    return this.state.core
  }

  getOptions(): Opts {
    return this.options
  }

  getPluginState<T>(pluginId: string): T {
    return this.state.plugins.get(pluginId) as T
  }

  initPluginState<T>(pluginId: string, initialState: T): void {
    if (this.state.plugins.has(pluginId)) {
      return
    }
    this.state.plugins.set(pluginId, initialState)
  }

  setPluginState<T>(pluginId: string, nextState: T): void {
    this.state.plugins.set(pluginId, nextState)
  }

  applyOperation(op: Operation): void {
    this.applyCoreOperation(op)

    this.plugins.forEach((plugin) => {
      plugin.onOperation?.(op, this)
    })

    this.state.viewDirty = true

    this.rebuildViewState({ type: "operation", operation: op })

    this.notify()
  }

  private applyCoreOperation(operation: Operation): void {
    switch (operation.type) {
      case 'add-node': {
        const parentId = operation.payload.parentId || null
        this.addNode(parentId, operation.payload.node)
        break
      }
      case 'remove-node': {
        const id = operation.payload.id
        if (id) {
          this.removeNode(id)
        }
        break
      }
      case 'expand-node': {
        const id = operation.payload.id
        if (id) {
          this.expandNode(id)
        }
        break
      }
      case 'collapse-node': {
        const id = operation.payload.id
        if (id) {
          this.collapseNode(id)
        }
        break
      }
      case 'toggle-expand': {
        const id = operation.payload.id
        if (id) {
          this.toggleExpand(id)
        }
        break
      }
      case 'set-column-visibility': {
        const { index, id, visible } = operation.payload
        if (id && visible !== undefined) {
          this.setStateColumnVisibility(index, visible)
          this.viewColumnsDirty = true
        }
        break
      }
      case 'set-columns-visibility': {
        const { visible } = operation.payload
        if (visible !== undefined) {
          this.setStateColumnsVisibility(visible)
          this.viewColumnsDirty = true
        }
        break
      }
      case 'set-node-visibility': {
        const { id, visible } = operation.payload
        if (id && visible !== undefined) {
          this.setStateNodeVisibility(id, visible)
        }
        break
      }
      case 'set-column-width': {
        const { index, width } = operation.payload
        if (width !== undefined) {
          this.setStateColumnWidth(index, width)
          this.viewColumnsDirty = true
        }
        break
      }
      case 'set-columns-width': {
        const { indexes, widths } = operation.payload

        if (!indexes && widths && Array.isArray(widths)) {
          this.setAllColumnsWidth(widths)
          this.viewColumnsDirty = true
        } else if (indexes && widths && typeof widths === 'object' && !Array.isArray(widths)) {
          const hasChanges = this.setColumnsWidth(indexes, widths)
          if (hasChanges) {
            this.viewColumnsDirty = true
          }
        }
        break
      }
      case 'update-options': {
        const { options } = operation.payload
        if (options !== undefined) {
          this.updateOptions(options as Opts)
        }
        break
      }
      case 'set-metadata': {
        const { metadata } = operation.payload
        if (metadata !== undefined) {
          this.setMetadata(metadata)
        }
        break
      }
      default:
        break
    }
  }

  private setStateColumnVisibility(index: number, visible: boolean): void {
    const column = this.state.core.columns[index]

    if (column) {
      if (!visible) {
        this.hiddenColumns.add(index)
      } else {
        this.hiddenColumns.delete(index)
      }
    }
  }

  private setStateColumnWidth(index: number, width: number): void {
    const column = this.state.core.columns[index]
    if (column) {
      column.width = width
    }
  }

  private setAllColumnsWidth(widths: Array<number | null | undefined>): void {
    this.state.core.columns.forEach((column, index) => {
      const nextWidth = widths[index]
      if (nextWidth !== null && nextWidth !== undefined) {
        column.width = nextWidth
      }
    })
  }

  private setColumnsWidth(indexes: number[], widths: Record<number, number>): boolean {
    let hasChanges = false

    indexes.forEach((index) => {
      const column = this.state.core.columns[index]

      if (column && widths[index] !== undefined && widths[index] !== column.width) {
        hasChanges = true
        column.width = widths[index]
      }
    })

    return hasChanges
  }

  private setStateColumnsVisibility(visible: boolean): void {
    if (!visible) {
      this.hiddenColumns.clear()
      this.state.core.columns.forEach((column, index) => {
        this.hiddenColumns.add(index)
      })
    } else {
      this.hiddenColumns.clear()
    }
  }

  private setStateNodeVisibility(id: NodeId, visible: boolean): void {
    const node = this.state.core.nodeMap.get(id)

    if (node) {
      if (!visible) {
        this.hiddenNodes.add(id)
      } else {
        this.hiddenNodes.delete(id)
      }
    }
  }

  private addNode(parentId: NodeId | null, node: { id: NodeId; value: unknown[] }): void {
    const columns = this.state.core.columns;

    const item =
      this.createNode?.({ parentId, columns, payload: { id: node.id, value: node.value } }) ??
      this.createDefaultNode(parentId, columns, { id: node.id, value: node.value })

    this.insertItem(item, parentId)
  }

  private insertItem(
    item: {
      id: NodeId
      parent: NodeId | null
      value: unknown[]
      children?: Array<{ id: NodeId; parent: NodeId | null; value: unknown[] }>
    },
    overrideParentId?: NodeId | null,
  ): void {
    const parentId = overrideParentId ?? item.parent ?? null
    const childIds = new Set((item.children ?? []).map((child) => child.id))

    const depth = parentId && this.state.core.nodeMap.get(parentId) ? this.state.core.nodeMap.get(parentId)!.depth + 1 : 0

    this.state.core.nodeMap.set(item.id, {
      id: item.id,
      parent: parentId,
      children: childIds,
      value: item.value,
      depth,
    })

    if (parentId) {
      const parent = this.state.core.nodeMap.get(parentId)
      if (parent && !parent.children.has(item.id)) {
        parent.children.add(item.id)
      }
    } else if (!this.state.core.rootIds.has(item.id)) {
      this.state.core.rootIds.add(item.id)
      this.expanded.add(item.id)
    }

    item.children?.forEach((child) => {
      this.insertItem(child, item.id)
    })
  }

  private createDefaultNode(
    parentId: NodeId | null,
    columns: CoreColumn[],
    payload: {
      id: NodeId
      value: unknown[]
    }
  ): {
    id: NodeId
    parent: NodeId | null
    value: unknown[]
    children: []
  } {

    return {
      id: payload.id ?? this.generateNodeId(),
      parent: parentId,
      value: payload.value ?? columns.map(() => ({ text: 'New item', editable: true })),
      children: [],
    }
  }

  private generateNodeId(): NodeId {
    return crypto.randomUUID()
  }

  private removeNode(id: NodeId): void {
    if (!this.state.core.nodeMap.has(id)) {
      return
    }

    const toRemove = this.collectSubtreeIds(id)
    const parentId = this.state.core.nodeMap.get(id)?.parent ?? null

    toRemove.forEach((nodeId) => {
      this.state.core.nodeMap.delete(nodeId)

      this.expanded.delete(nodeId)
      this.hiddenNodes.delete(nodeId)
      this.disabledNodes.delete(nodeId)
    })

    if (parentId) {
      const parent = this.state.core.nodeMap.get(parentId)
      if (parent) {
        parent.children.delete(id)
      }
    } else {
      this.state.core.rootIds.delete(id)
    }
  }

  private collectSubtreeIds(id: NodeId): NodeId[] {
    const collected: NodeId[] = []
    const visit = (nodeId: NodeId) => {
      collected.push(nodeId)
      const node = this.state.core.nodeMap.get(nodeId)
      if (!node) {
        return
      }
      node.children.forEach(visit)
    }
    visit(id)
    return collected
  }

  private expandNode(id: NodeId): void {
    const node = this.state.core.nodeMap.get(id)

    if (!node || node.children.size === 0) {
      return
    }
    this.expanded.add(id)
  }

  private collapseNode(id: NodeId): void {
    if (!this.expanded.has(id)) {
      return
    }
    this.expanded.delete(id)
  }

  private toggleExpand(id: NodeId): void {
    const node = this.state.core.nodeMap.get(id)
    if (!node || node.children.size === 0) {
      return
    }
    if (this.expanded.has(id)) {
      this.expanded.delete(id)
    } else {
      this.expanded.add(id)
    }
  }

  private rebuildViewState(effect?: RebuildViewStateEffect): void {
    if (!this.state.viewDirty) return

    const originalMetadata = {
      nodeMap: new Map(this.state.core.nodeMap),
      rootIds: [...this.state.core.rootIds],
      columns: [...this.state.core.columns],
      expanded: new Set(this.expanded),
      hiddenColumns: new Set(this.hiddenColumns),
      hiddenNodes: new Set(this.hiddenNodes),
      disabledNodes: new Set(this.disabledNodes),
    }

    const pipeline = this.viewPipeline.run(this.plugins, originalMetadata, this)
    const metadata = pipeline.metadata
    const isCoreUpdated = pipeline.isUpdated
    console.log('isCoreUpdated', isCoreUpdated, effect)

    const columnsDirty = this.viewColumnsDirty || !this.cacheViewColumns
    if (columnsDirty) {
      this.cacheViewColumns = this.createViewColumns({ columns: this.state.core.columns, hiddenColumns: this.hiddenColumns })
      this.viewColumnsDirty = false
    }

    const structuralOp = effect?.type === 'operation' && (effect.operation.type === 'add-node' || effect.operation.type === 'remove-node')

    // --- NODES ---
    if (
      isCoreUpdated ||
      !this.linearNodes?.length ||
      !effect ||
      columnsDirty ||
      structuralOp
    ) {

      this.linearIndex.clear()
      this.linearNodes = this.buildLinearNodes({ metadata, buildCells: this.buildCells!, onNodeVisit: (node) => this.linearIndex.set(node.id, node) })

      this.plugins.forEach((plugin) => {
        plugin.onMetadata?.({ linearNodes: this.linearNodes!, visibleNodesIndexes: this.visibleNodesIndexes, linearIndex: this.linearIndex }, this)
      })

      this.visibleFenwick = new FenwickTree(this.linearNodes.length)

      let visibleFenwickBuild: number[] = []
      let visibleNodesIndexes: number[] = []

      for (let i = 0; i < this.linearNodes.length; i++) {
        const node = this.linearNodes[i]!
        visibleFenwickBuild.push(node.visible ? 1 : 0)
        if (node.visible) {
          visibleNodesIndexes.push(i)
        }
      }
      this.visibleFenwick.build(
        visibleFenwickBuild
      )
      this.visibleNodesIndexes = visibleNodesIndexes
    } else {
      switch (effect.type) {
        case 'operation': {
          const op = effect.operation
          switch (op.type) {
            case 'expand-node':
              this.expandLinearNode(op.payload.id)
              break
            case 'collapse-node':
              this.collapseLinearNode(op.payload.id)
              break
            case 'toggle-expand': {
              const node = this.linearIndex.get(op.payload.id)
              if (node?.expanded) {
                this.collapseLinearNode(op.payload.id)
              } else {
                this.expandLinearNode(op.payload.id)
              }
              break
            }
            case 'set-node-visibility':
              this.setLinearVisibility(op.payload.id, op.payload.visible)
              break
            default:
              this.plugins.forEach((plugin) => {
                plugin.onIncrementalUpdate?.({
                  op, metadata, linearNodes: this.linearNodes!, visibleNodesIndexes: this.visibleNodesIndexes,
                }, this)
              })
          }
          break
        }
      }
    }

    this.state.viewState = {
      metadata,
      columns: this.cacheViewColumns!,
      nodes: this.linearNodes,
      options: this.options,
      visibleNodesIndexes: this.visibleNodesIndexes,
    }

    this.state.viewDirty = false
  }

  public getViewMetadata() {
    return this.state.viewState?.metadata
  }

  private expandLinearNode(id: NodeId) {
    const node = this.linearIndex.get(id)
    if (!node || node.expanded || !node.hasChildren) return

    node.expanded = true

    const start = node.index + 1
    const end = node.index + node.subtreeSize

    // куда вставлять в visibleNodes
    const insertAt = this.visibleFenwick.sum(start - 1)

    const toInsert: number[] = []

    for (let i = start; i < end; i++) {
      const n = this.linearNodes[i]
      if (!n) continue

      if (n.depth === node.depth + 1) {
        if (!n.visible) {
          n.visible = true
          this.visibleFenwick.add(i, +1)
          toInsert.push(i)
        }
      }

      if (n.hasChildren && !n.expanded) {
        i += n.subtreeSize - 1
      }
    }

    if (toInsert.length > 0) {
      this.visibleNodesIndexes.splice(insertAt, 0, ...toInsert)
    }
  }

  private setLinearVisibility(id: NodeId, visible: boolean) {
    const node = this.linearIndex.get(id)
    if (!node) return

    // ничего не меняем
    if (node.visible === visible) return

    const index = node.index

    if (!visible) {
      // --- скрываем узел ---
      node.visible = false
      this.visibleFenwick.add(index, -1)

      const removeAt = this.visibleFenwick.sum(index - 1)

      let removeCount = 1

      // скрываем всё поддерево
      if (node.hasChildren) {
        const start = index + 1
        const end = index + node.subtreeSize

        for (let i = start; i < end; i++) {
          const n = this.linearNodes[i]!
          if (n.visible) {
            n.visible = false
            this.visibleFenwick.add(i, -1)
            removeCount++
          }
        }
      }

      this.visibleNodesIndexes.splice(removeAt, removeCount)
    } else {
      // --- показываем узел ---
      const insertAt = this.visibleFenwick.sum(index - 1)

      node.visible = true
      this.visibleFenwick.add(index, +1)

      const toInsert: number[] = [index]

      // если узел раскрыт — показываем прямых детей
      if (node.expanded && node.hasChildren) {
        const start = index + 1
        const end = index + node.subtreeSize

        for (let i = start; i < end; i++) {
          const n = this.linearNodes[i]!

          if (n.depth === node.depth + 1) {
            if (!n.visible) {
              n.visible = true
              this.visibleFenwick.add(i, +1)
              toInsert.push(i)
            }
          }

          if (n.hasChildren && !n.expanded) {
            i += n.subtreeSize - 1
          }
        }
      }

      this.visibleNodesIndexes.splice(insertAt, 0, ...toInsert)
    }
  }

  private collapseLinearNode(id: NodeId) {
    const node = this.linearIndex.get(id)
    if (!node || !node.expanded) return

    node.expanded = false

    const start = node.index + 1
    const end = node.index + node.subtreeSize

    // позиция первого скрываемого элемента
    const removeAt = this.visibleFenwick.sum(start - 1)

    let removeCount = 0

    for (let i = start; i < end; i++) {
      const n = this.linearNodes[i]!

      if (n.visible) {
        n.visible = false
        this.visibleFenwick.add(i, -1)
        removeCount++
      }
    }

    if (removeCount > 0) {
      this.visibleNodesIndexes.splice(removeAt, removeCount)
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
