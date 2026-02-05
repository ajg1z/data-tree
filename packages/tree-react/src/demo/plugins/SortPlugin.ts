import type { CoreNode, CustomOperation, EnginePlugin, NodeId, Operation, ViewMetadata } from '@ajgiz/tree-core'
import type { TreeDataEngine } from '@ajgiz/tree-core'

export type SortType = 'asc' | 'desc'

export interface SortPluginState {
  activeColumnIndex: number
  sortType: SortType
}

interface SetSortOperation extends CustomOperation {
  type: 'custom'
  payload: {
    type: 'set-sort'
    data: { activeColumnIndex: number; direction: SortType }
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

const getSortedChildIds = (
  childIds: NodeId[],
  sortState: SortPluginState | null,
  nodeMap: Map<NodeId, CoreNode>,
): NodeId[] => {
  if (!sortState) {
    return childIds
  }

  const { activeColumnIndex, sortType } = sortState
  const sorted = [...childIds]

  sorted.sort((leftId, rightId) => {
    const leftNode = nodeMap.get(leftId)
    const rightNode = nodeMap.get(rightId)
    const leftValue = resolveText(leftNode?.value?.[activeColumnIndex])
    const rightValue = resolveText(rightNode?.value?.[activeColumnIndex])
    const result = leftValue.localeCompare(rightValue, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
    return sortType === 'asc' ? result : -result
  })

  return sorted
}

export class SortPlugin implements EnginePlugin {
  id = 'sort'

  private dirty = true

  private cacheCoreData: { nodeMap: Map<NodeId, CoreNode>, rootIds: NodeId[] } | null = null

  init(engine: TreeDataEngine) {
    engine.initPluginState<SortPluginState>(this.id, {
      activeColumnIndex: 0,
      sortType: 'asc',
    })
  }

  onOperation(op: SetSortOperation, engine: TreeDataEngine) {
    const updateOperation: (Operation['type'] | 'set-sort')[] = [
      'set-sort',
      "add-node",
      "remove-node",
    ]

    if (op?.type === 'custom' && op.payload.type === 'set-sort') {
      const payload = op.payload.data
      const currentState = engine.getPluginState<SortPluginState | null>(this.id) ?? {
        activeColumnIndex: 0,
        sortType: 'asc',
      }

      const newState: SortPluginState = {
        activeColumnIndex: payload?.activeColumnIndex ?? currentState.activeColumnIndex,
        sortType: payload?.direction || currentState.sortType === 'asc' ? 'desc' : 'asc',
      }

      engine.setPluginState<SortPluginState>(this.id, newState)
    }

    const isUpdateCache = updateOperation.includes(op.type)
    if (isUpdateCache) {
      this.dirty = true
    }
    // console.log('cache', th)
  }

  run(ctx: { metadata: ViewMetadata, isUpdated: boolean, index: number }, engine: TreeDataEngine) {
    const { metadata } = ctx

    const sortState = engine.getPluginState<SortPluginState | null>(this.id)

    const isPrevDataUpdated = ctx.index > 0 && ctx.isUpdated === true

    if (!sortState) {
      this.dirty = false

      return {
        data: metadata,
        isUpdated: ctx.isUpdated,
      }
    }

    if (this.dirty === false && isPrevDataUpdated === false) {
      this.dirty = false

      return {
        data: {
          ...metadata,
          nodeMap: this.cacheCoreData?.nodeMap ?? metadata.nodeMap,
          rootIds: this.cacheCoreData?.rootIds ?? metadata.rootIds,
        },
        isUpdated: false,
      }
    }

    const sortedNodeMap = new Map<NodeId, CoreNode>()
    const sortedRootIds: NodeId[] = []

    const visit = (nodeId: NodeId): void => {
      const node = metadata.nodeMap.get(nodeId)
      if (!node) {
        return
      }
      const sortedChildren = getSortedChildIds(Array.from(node.children), sortState, metadata.nodeMap)
      const sortedNode: CoreNode = {
        ...node,
        children: new Set(sortedChildren),
      }
      sortedNodeMap.set(nodeId, sortedNode)

      sortedChildren.forEach((childId) => {
        visit(childId)
      })
    }

    [...metadata.rootIds].sort((a, b) => {
      const leftNode = metadata.nodeMap.get(a)
      const rightNode = metadata.nodeMap.get(b)
      const leftValue = resolveText(leftNode?.value?.[sortState.activeColumnIndex])
      const rightValue = resolveText(rightNode?.value?.[sortState.activeColumnIndex])
      const result = leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return sortState.sortType === 'asc' ? result : -result
    }).forEach((rootId) => {
      sortedRootIds.push(rootId)
      visit(rootId)
    })

    this.cacheCoreData = { nodeMap: sortedNodeMap, rootIds: sortedRootIds }

    this.dirty = false

    return {
      data: {
        ...metadata,
        nodeMap: sortedNodeMap,
        rootIds: sortedRootIds,
      }, isUpdated: true
    }
  }
}