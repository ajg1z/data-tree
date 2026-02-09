
import type { TreeDataEngine } from "./TreeDataEngine"

export type NodeId = string
export type ColumnId = string
export type TSelectionMode = 'Single' | 'Multi' | 'Extended' | 'NoSelection'
export type TSelectionBehavior = 'SelectItems' | 'SelectRows' | 'SelectColumns' | 'NoSelection'

export interface CoreNode {
  id: NodeId
  parent: NodeId | null
  children: Set<NodeId>
  value: unknown[]
  disabled?: boolean
  depth: number
  // visible?: boolean
}

export interface CoreColumn {
  id: ColumnId
  text: string
  width: number
  // visible: boolean
  isAutoWidth?: boolean
}

export interface ViewMetadata<ViewOpts extends Record<string, any> = Record<string, any>> {
  nodeMap: Map<NodeId, CoreNode>
  rootIds: NodeId[]
  columns: CoreColumn[]
  options?: ViewOpts
  expanded: Set<NodeId>
  hiddenColumns: Set<number>
  hiddenNodes: Set<NodeId>
  disabledNodes: Set<NodeId>
}

export interface ViewNode {
  id: NodeId
  depth: number
  hasChildren: boolean
  cells: ViewCell[]
  disabled: boolean
  children?: ViewNode[]
}

export interface ViewCell {
  renderer: 'tree/cell' | 'text' | string
  payload: {
    text: string
    depth?: number
    hasChildren?: boolean
  }
}

export interface ViewColumn {
  id: ColumnId
  text: string
  width: number
  // visible: boolean
  isAutoWidth?: boolean
}

export interface TreeDataOptions {
  paddingLeft?: number
}

export interface ViewState<ViewOpts extends Record<string, any> = Record<string, any>> {
  options: TreeDataOptions
  nodes: LinearNode[]
  metadata: ViewMetadata<ViewOpts>
  columns: ViewColumn[]
  visibleNodesIndexes: number[]
}


export interface EngineStateCore {
  nodeMap: Map<NodeId, CoreNode>
  rootIds: Set<NodeId>
  columns: CoreColumn[]
}

export interface EngineState<ViewOpts extends Record<string, any> = Record<string, any>> {
  core: EngineStateCore
  plugins: Map<string, unknown>
  viewState: ViewState<ViewOpts> | null
  viewDirty: boolean
}


export type AddNodeOperation = {
  payload: {
    parentId?: NodeId | null
    node: {
      id: NodeId
      value: unknown[]
    }
  }
  type: 'add-node'
}

export type RemoveNodeOperation = {
  payload: {
    id: NodeId
  }
  type: 'remove-node'
}

export type ExpandNodeOperation = {
  payload: {
    id: NodeId
  }
  type: 'expand-node'
}

export type CollapseNodeOperation = {
  payload: {
    id: NodeId
  }
  type: 'collapse-node'
}

export type ToggleExpandOperation = {
  payload: {
    id: NodeId
  }
  type: 'toggle-expand'
}

export type SetColumnVisibilityOperation = {
  payload: {
    index: number
    id?: string
    visible: boolean
  }
  type: 'set-column-visibility'
}

export type SetColumnsVisibilityOperation = {
  payload: {
    visible: boolean
  }
  type: 'set-columns-visibility'
}

export type SetNodeVisibilityOperation = {
  payload: {
    id: NodeId
    visible: boolean
  }
  type: 'set-node-visibility'
}

export type SetColumnWidthOperation = {
  payload: {
    index: number
    id?: string
    width: number
  }
  type: 'set-column-width'
}

export type SetColumnsWidthOperation = {
  payload: {
    indexes?: number[]
    widths: Array<number | null | undefined> | Record<number, number>
  }
  type: 'set-columns-width'
}

export type CustomOperation = {
  type: 'custom'
  payload: {
    type: string
    data?: Record<string, unknown>
  }
}

export type UpdateOptionsOperation = {
  payload: {
    options: Record<string, unknown>
  }
  type: 'update-options'
}


export type LinearNode = {
  id: NodeId
  depth: number
  hasChildren: boolean
  expanded: boolean
  visible: boolean

  /** индекс в линейном массиве */
  index: number

  /** сколько элементов в поддереве (ВСЕ, включая скрытые) */
  subtreeSize: number

  cells: ViewCell[]
  disabled?: boolean

  metadata?: Record<string, any>
}


export type SetMetadataOperation = {
  payload: {
    metadata: {
      expanded?: Set<NodeId>
      hiddenColumns?: Set<number>
      hiddenNodes?: Set<NodeId>
      disabledNodes?: Set<NodeId>
    }
  }
  type: 'set-metadata'
}

export type Operation = AddNodeOperation | RemoveNodeOperation | ExpandNodeOperation | CollapseNodeOperation | ToggleExpandOperation
  | SetColumnVisibilityOperation | SetColumnsVisibilityOperation | SetNodeVisibilityOperation | SetColumnWidthOperation
  | SetColumnsWidthOperation | UpdateOptionsOperation | SetMetadataOperation | CustomOperation

export interface EngineAPI {
  apply(op: Operation): void
  getPluginState<T>(pluginId: string): T
  resetRuntime?(): void
}

export interface EnginePlugin {
  id: string
  init?(engine: any): void
  onOperation?(op: Operation, engine: any): void
  onMetadata?(params: { linearNodes: LinearNode[], visibleNodesIndexes: number[], linearIndex: Map<NodeId, LinearNode> }, engine: TreeDataEngine<any, any>): void
  onIncrementalUpdate?(payload: { op: Operation, metadata: ViewMetadata, linearNodes: LinearNode[], visibleNodesIndexes: number[] }, engine: TreeDataEngine<any, any>): void
  run?(ctx: { metadata: ViewMetadata, isUpdated: boolean, index: number, originalMetadata: ViewMetadata, effect?: RebuildViewStateEffect }, engine: TreeDataEngine<any, any>): { data: ViewMetadata, isUpdated: boolean }
}

export interface SelectionPluginState {
  selectionMode: TSelectionMode
  selectionBehavior: TSelectionBehavior
  selectedItems: Map<NodeId, number[]>
}

export type RebuildViewStateEffect = {
  type: "updateOptions"
  options?: Record<string, unknown>
} | {
  type: "operation"
  operation: Operation
}

export interface TreeDataEngineOptions<Opts extends Record<string, any> = Record<string, any>, Metadata extends Record<string, any> = Record<string, any>> {
  options?: Opts
  plugins?: EnginePlugin[]

  initData: () => {
    nodeMap: Map<NodeId, CoreNode>
    rootIds: Set<NodeId>
    columns: CoreColumn[]
  }

  metadata?: {
    expanded?: Set<NodeId>
    hiddenColumns?: Set<number>
    hiddenNodes?: Set<NodeId>
    disabledNodes?: Set<NodeId>
  }

  createViewColumns?: (params: { columns: CoreColumn[], hiddenColumns: Set<number> }) => ViewColumn[]

  buildLinearNodes?: (params: { metadata: ViewMetadata, buildCells: TreeDataEngineOptions['buildCells'], onNodeVisit?: (node: LinearNode) => void, }) => LinearNode[]

  buildCells?: (params: { values: unknown[], depth: number, hasChildren: boolean, columns: CoreColumn[], hiddenColumns: Set<number>, }) => ViewCell[]

  createNode?: (context: {
    parentId: NodeId | null
    columns: CoreColumn[],
    payload: {
      id: NodeId
      value: unknown[]
    }
  }) => {
    id: NodeId
    parent: NodeId | null
    value: unknown[]
    children?: Array<{ id: NodeId; parent: NodeId | null; value: unknown[] }>
  }
}