import { createWorker } from "./createWorker"
import type { CoreNode, EngineStateCore, EngineState, HierarchicalListItem, NodeId } from "../types"
import type { HierarchicalListValue } from "../types"

export function prepare( rawData: HierarchicalListValue ): EngineStateCore {
    const visitTree = (
        item: HierarchicalListItem,
        parentId: NodeId | null,
        nodesById: Map<NodeId, CoreNode>,
        depth: number,
      ) => {
        const childIds = (item.children ?? []).map((child) => child.id)

        nodesById.set(item.id, {
          id: item.id,
          parent: parentId,
          children: new Set(childIds),
          depth,
          value: item.value,
          disabled: item.disabled,
        })

        item.children?.forEach((child) => visitTree(child, item.id, nodesById, depth + 1))
      }
      
    const nodeMap = new Map< NodeId, CoreNode >()

    const rootIds: Set<NodeId> = new Set()
    
    rawData.value.forEach((root) => {
      rootIds.add(root.id)
      visitTree(root, null, nodeMap, 0)
    })
    
    return {
        nodeMap,
        rootIds,
        columns: [],
    }
}

createWorker([
    {
        type: 'prepare',
        handler: prepare,
    }
])