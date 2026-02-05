import type { CoreColumn, LinearNode, NodeId, TreeDataEngineOptions, ViewCell, ViewColumn, ViewMetadata } from "./types"

export function buildCells(params: {
    values: unknown[],
    depth: number,
    hasChildren: boolean,
    columns: CoreColumn[],
    hiddenColumns: Set<number>
}) {
    const { values, depth, hasChildren, columns, hiddenColumns } = params

    const cells: ViewCell[] = []

    values.slice(0, columns.length).forEach((value, index) => {
        if (hiddenColumns.has(index)) {
            return
        }

        const text = resolveText(value)

        if (index === 0) {
            cells.push({
                renderer: 'tree/cell',
                payload: { text, depth, hasChildren },
            })
            return
        }

        cells.push({ renderer: 'text', payload: { text } })
    })

    return cells
}

export function resolveText(value: unknown): string {
    if (value === null || value === undefined) {
        return ''
    }

    if (typeof value === 'object' && 'text' in (value as { text?: unknown })) {
        const text = (value as { text?: unknown }).text
        return text === null || text === undefined ? '' : String(text)
    }

    return String(value)
}


export function createViewColumns(params: { columns: CoreColumn[], hiddenColumns: Set<number> }): ViewColumn[] {
    const { columns, hiddenColumns } = params

    const viewColumns: ViewColumn[] = []

    columns.forEach((column, index) => {
        if (hiddenColumns.has(index)) {
            return
        }

        viewColumns.push({
            id: column.id,
            text: column.text,
            width: column.width ?? 0,
            isAutoWidth: column.isAutoWidth,
        })
    })

    return viewColumns
}

export function buildLinearNodes(params:
    {
        metadata: ViewMetadata, buildCells: TreeDataEngineOptions['buildCells'],
        onNodeVisit?: (node: LinearNode) => void
    }): LinearNode[] {
    const { metadata, buildCells, onNodeVisit } = params

    const result: LinearNode[] = []

    const visit = (id: NodeId, depth: number, parentVisible: boolean): number => {
        const node = metadata.nodeMap.get(id)
        if (!node) {
            return 0
        }

        const hasChildren = node.children.size > 0
        const expanded = metadata.expanded.has(id)
        const isVisible = parentVisible && !metadata.hiddenNodes.has(id)

        const linearNode: LinearNode = {
            id,
            depth,
            hasChildren,
            expanded,
            visible: isVisible,
            index: result.length,
            subtreeSize: 1,
            disabled: Boolean(node.disabled),
            cells: buildCells({
                values: node.value,
                depth,
                hasChildren,
                columns: metadata.columns,
                hiddenColumns: metadata.hiddenColumns,
            }),
        }

        result.push(linearNode)
        onNodeVisit?.(linearNode)

        if (hasChildren) {
            let subtree = 1
            node.children.forEach(childId => {
                subtree += visit(childId, depth + 1, isVisible && expanded)
            })
            linearNode.subtreeSize = subtree
        }

        return linearNode.subtreeSize
    }

    metadata.rootIds.forEach(id => visit(id, 0, true))

    return result
}