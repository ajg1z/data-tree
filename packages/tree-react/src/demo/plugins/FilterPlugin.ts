import type { CoreNode, EnginePlugin, NodeId, ViewMetadata, ViewCell, Operation, CustomOperation } from '@ajgiz/tree-core'
import type { TreeDataEngine } from '@ajgiz/tree-core'

export type FilterPredicate = (row: { id: NodeId; cells: string[] }) => boolean

export interface FilterPluginState {
  predicate: FilterPredicate | null
  filterQuery: string
}

interface SetFilterOperation extends CustomOperation {
  type: 'custom'
  payload: {
    type: 'set-filter'
    data: { filterQuery: string; predicate?: FilterPredicate | null }
  }
}

const resolveText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object' && 'text' in (value as { text?: unknown })) {
    const text = (value as { text?: unknown }).text
    return text === null || text === undefined ? '' : String(text)
  }
  return String(value)
}

const computeFilterMatches = (
  metadata: ViewMetadata,
  predicate: FilterPredicate,
): Map<NodeId, boolean> => {
  const matches = new Map<NodeId, boolean>()

  const visit = (id: NodeId): boolean => {
    const node = metadata.nodeMap.get(id)

    if (!node || metadata.hiddenNodes.has(id)) {
      return false
    }

    const cells = node.value.map((value) => resolveText(value))

    let selfMatches = false
    try {
      selfMatches = predicate({ id, cells })
    } catch {
      selfMatches = false
    }

    let childMatches = false
    node.children.forEach((childId) => {
      if (visit(childId)) {
        childMatches = true
      }
    })

    const result = selfMatches || childMatches
    matches.set(id, result)
    return result
  }

  metadata.rootIds.forEach((rootId) => visit(rootId))

  return matches
}

export class FilterPlugin implements EnginePlugin {
  id = 'filter'
  private matchesCache: Map<NodeId, boolean> | null = null
  private cacheDirty = true
  private resetSortPending = false
  private lastFilterQuery: string = ''

  private cacheCoreData: { nodeMap: Map<NodeId, CoreNode>, rootIds: NodeId[] } | null = null

  init(engine: TreeDataEngine) {
    engine.initPluginState<FilterPluginState>(this.id, {
      predicate: null,
      filterQuery: '',
    })
  }

  onOperation(op: SetFilterOperation, engine: TreeDataEngine) {
    const updateOperation: (Operation['type'] | 'set-filter')[] = [
      'set-filter',
      "add-node",
      "remove-node",
    ]

    if (op?.type === 'custom' && op.payload.type === 'set-filter') {
      const payload = op.payload.data

      if (payload?.filterQuery?.trim()) {
        engine.setPluginState<FilterPluginState>(this.id, {
          filterQuery: payload?.filterQuery ?? '',
          predicate: payload?.predicate ?? null,
        })
        this.resetSortPending = false
      } else {
        engine.setPluginState<FilterPluginState>(this.id, {
          filterQuery: '',
          predicate: null,
        })
        this.resetSortPending = true
        this.matchesCache = null
      }
    }

    const isUpdateCache = updateOperation.includes(op?.payload?.type)
    if (isUpdateCache) {
      this.cacheDirty = true
    }
  }

  run(ctx: { metadata: ViewMetadata, isUpdated: boolean, index: number, originalMetadata: ViewMetadata }, engine: TreeDataEngine): { data: ViewMetadata, isUpdated: boolean } {
    const { metadata, originalMetadata } = ctx

    const filterState = engine.getPluginState<FilterPluginState>(this.id)
    const filterQuery =  filterState?.filterQuery?.trim() ?? ''
    const hasQuery = Boolean(filterQuery.trim())
    if (filterQuery !== this.lastFilterQuery) {
      this.lastFilterQuery = filterQuery
      this.cacheDirty = true
    }

    if (!hasQuery) {
      this.lastFilterQuery = ''
      if (this.resetSortPending) {
        this.resetSortPending = false
        this.cacheDirty = false
        this.matchesCache = null
        return { data: originalMetadata, isUpdated: true }
      }
      return { data: originalMetadata, isUpdated: false }
    }

    if (!this.cacheDirty && this.matchesCache) {
      return {
        data: {
          ...originalMetadata,
          nodeMap: this.cacheCoreData?.nodeMap ?? originalMetadata.nodeMap,
          rootIds: this.cacheCoreData?.rootIds ?? originalMetadata.rootIds,
        }, isUpdated: false
      }
    }

    const predicate = filterState?.predicate ?? ((row: { cells: string[] }) =>
      row.cells.some((c) => c.toLowerCase().includes(filterQuery!.toLowerCase())))
    this.matchesCache = computeFilterMatches(metadata, predicate)
    this.cacheDirty = false

    const filteredNodeMap = new Map<NodeId, CoreNode>()
    const filteredRootIds: NodeId[] = []

    const visit = (nodeId: NodeId): void => {
      const node = metadata.nodeMap.get(nodeId)
      if (!node) {
        return
      }

      const matches = this.matchesCache?.get(nodeId) ?? false
      if (!matches) {
        return
      }

      const filteredChildren = new Set<NodeId>()

      const filteredNode: CoreNode = {
        ...node,
        children: filteredChildren,
      }

      filteredNodeMap.set(nodeId, filteredNode)

      node.children.forEach((childId) => {
        if (this.matchesCache?.get(childId)) {
          filteredChildren.add(childId)
          visit(childId)
        }
      })
    }

    metadata.rootIds.forEach((rootId) => {
      if (this.matchesCache?.get(rootId)) {
        filteredRootIds.push(rootId)
        visit(rootId)
      }
    })

    this.cacheCoreData = { nodeMap: filteredNodeMap, rootIds: filteredRootIds }

    return {
      data: {
        ...metadata,
        nodeMap: this.cacheCoreData?.nodeMap ?? metadata.nodeMap,
        rootIds: this.cacheCoreData?.rootIds ?? metadata.rootIds,
      }, isUpdated: true
    }
  }
}