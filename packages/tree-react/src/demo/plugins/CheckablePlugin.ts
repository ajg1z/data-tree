import type { CoreNode, CustomOperation, EnginePlugin, LinearNode, NodeId, Operation } from '@ajgiz/tree-core'
import type { TreeDataEngine } from '@ajgiz/tree-core'

export type CheckableValue = 'check' | 'uncheck' | 'partial'

export interface CheckablePluginState {
    checkableState: Map<NodeId, CheckableValue>
    autoParent: boolean
}

export interface CheckState {
    checked: boolean
    indeterminate: boolean
}

interface SetCheckOperation extends CustomOperation {
    type: 'custom'
    payload: {
        type: 'set-check'
        data: { id: NodeId; checked?: boolean }
    }
}

interface SetAutoParentOperation extends CustomOperation {
    type: 'custom'
    payload: {
        type: 'set-auto-parent'
        data: { autoParent?: boolean }
    }
}

function collectDescendantIds(nodeId: NodeId, nodeMap: Map<NodeId, CoreNode>): NodeId[] {
    const result: NodeId[] = []
    const node = nodeMap.get(nodeId)
    if (!node) return result

    const visit = (id: NodeId) => {
        result.push(id)
        const n = nodeMap.get(id)
        if (n) n.children.forEach(visit)
    }
    node.children.forEach(visit)
    return result
}

function collectAncestorIds(nodeId: NodeId, nodeMap: Map<NodeId, CoreNode>): NodeId[] {
    const result: NodeId[] = []
    let node = nodeMap.get(nodeId)
    while (node?.parent) {
        result.push(node.parent)
        node = nodeMap.get(node.parent)
    }
    return result
}

function collectDescendantIdsIncludingSelf(nodeId: NodeId, nodeMap: Map<NodeId, CoreNode>): NodeId[] {
    const result: NodeId[] = [nodeId]
    const visit = (id: NodeId) => {
        const n = nodeMap.get(id)
        if (n) n.children.forEach((childId) => { result.push(childId); visit(childId) })
    }
    visit(nodeId)
    return result
}

function computeParentValue(
    ancestorId: NodeId,
    nodeMap: Map<NodeId, CoreNode>,
    checkableState: Map<NodeId, CheckableValue>,
    autoParent: boolean
): CheckableValue {
    const descendantIds = collectDescendantIdsIncludingSelf(ancestorId, nodeMap)
    const withState = descendantIds.filter((id) => checkableState.has(id))
    if (withState.length === 0) return 'uncheck'

    const hasCheck = withState.some((id) => checkableState.get(id) === 'check')
    const hasUncheck = withState.some((id) => checkableState.get(id) === 'uncheck')
    const hasPartial = withState.some((id) => checkableState.get(id) === 'partial')

    const mixed = hasCheck && (hasUncheck || hasPartial) || hasPartial
    if (mixed && autoParent) return 'partial'
    if (hasCheck && !hasUncheck && !hasPartial) return 'check'
    return 'uncheck'
}

export function getCheckState(
    nodeId: NodeId,
    checkableState: Map<NodeId, CheckableValue>
): CheckState {
    const value = checkableState.get(nodeId)
    if (value === 'check') return { checked: true, indeterminate: false }
    if (value === 'partial') return { checked: false, indeterminate: true }
    return { checked: false, indeterminate: false }
}

export class CheckablePlugin implements EnginePlugin {
    id = 'checkable'

    private defaultAutoParent: boolean

    constructor(options?: { autoParent?: boolean }) {
        this.defaultAutoParent = options?.autoParent ?? true
    }

    init(engine: TreeDataEngine) {
        engine.initPluginState<CheckablePluginState>(this.id, {
            checkableState: new Map(),
            autoParent: this.defaultAutoParent,
        })
    }

    setCheckState(linearIndex: Map<NodeId, LinearNode>, state: CheckablePluginState) {
        state.checkableState.forEach((value, id) => {
            const node = linearIndex.get(id)

            if (!node) return

            node.metadata = {
                checkableState: value,
            }
        })
    }

    onOperation(op: SetCheckOperation | SetAutoParentOperation, engine: TreeDataEngine) {
        const operations: Operation['type'][] = ['remove-node', 'add-node']

        const state = engine.getPluginState<CheckablePluginState>(this.id)

        if (operations.includes(op?.type) && state?.checkableState?.size > 0) {
            const { linearIndex } = engine.getLinerNodes()
            this.setCheckState(linearIndex, state)
            return
        }

        if (op?.type === 'custom' && op.payload.type === 'set-check') {
            const { id, checked } = (op.payload.data ?? {}) as {
                id?: NodeId
                checked?: boolean
            }

            if (!id) return

            const core = engine.getCoreState()
            const node = core.nodeMap.get(id)
            if (!node) return

            const state = engine.getPluginState<CheckablePluginState>(this.id) ?? {
                checkableState: new Map(),
                autoParent: this.defaultAutoParent,
            }

            const autoParent = state.autoParent
            const checkableState = new Map(state.checkableState)

            const nextValue: CheckableValue =
                checked === true ? 'check' : 'uncheck'

            checkableState.set(id, nextValue)

            const descendantIds = collectDescendantIds(id, core.nodeMap)

            descendantIds.forEach((descId) => {
                if (checkableState.has(descId)) {
                    checkableState.set(descId, nextValue)
                }
            })

            const ancestorIds = collectAncestorIds(id, core.nodeMap)
            ancestorIds.forEach((ancestorId) => {
                const value = computeParentValue(ancestorId, core.nodeMap, checkableState, autoParent)
                checkableState.set(ancestorId, value)
            })

            engine.setPluginState<CheckablePluginState>(this.id, {
                checkableState,
                autoParent: state.autoParent,
            })
        }

        if (op?.type === 'custom' && op.payload.type === 'set-auto-parent') {
            const { autoParent } = (op.payload.data ?? {}) as {
                autoParent?: boolean
            }

            const state = engine.getPluginState<CheckablePluginState>(this.id) ?? {
                checkableState: new Map(),
                autoParent: this.defaultAutoParent,
            }

            engine.setPluginState<CheckablePluginState>(this.id, {
                checkableState: state.checkableState,
                autoParent: Boolean(autoParent),
            })
        }
    }

    onMetadata(params: { linearNodes: LinearNode[], visibleNodesIndexes: number[], linearIndex: Map<NodeId, LinearNode> }, engine: TreeDataEngine) {
        const { linearNodes, visibleNodesIndexes, linearIndex } = params

        const state = engine.getPluginState<CheckablePluginState>(this.id)
        if (!state) return

        state.checkableState.forEach((value, id) => {
            const node = linearIndex.get(id)

            if (!node) return

            node.metadata = {
                checkableState: value,
            }
        })
    }
}
