import { describe, it, expect } from 'vitest'
import type { CoreColumn, CoreNode, NodeId } from './types'
import { TreeDataEngine } from './TreeDataEngine'

function createInitData(): {
  nodeMap: Map<NodeId, CoreNode>
  rootIds: Set<NodeId>
  columns: CoreColumn[]
} {
  const columns: CoreColumn[] = [
    { id: 'col0', text: 'Name', width: 100 },
    { id: 'col1', text: 'Extra', width: 80 },
    { id: 'col2', text: 'Info', width: 60 },
  ]

  const nodeMap = new Map<NodeId, CoreNode>()

  const a: CoreNode = {
    id: 'A',
    parent: null,
    children: new Set(['B', 'E']),
    value: [{ text: 'A' }, 'a1', 'a2'],
    depth: 0,
  }
  const b: CoreNode = {
    id: 'B',
    parent: 'A',
    children: new Set(['C', 'D']),
    value: [{ text: 'B' }, 'b1', 'b2'],
    depth: 1,
  }
  const c: CoreNode = {
    id: 'C',
    parent: 'B',
    children: new Set(),
    value: [{ text: 'C' }, 'c1', 'c2'],
    depth: 2,
  }
  const d: CoreNode = {
    id: 'D',
    parent: 'B',
    children: new Set(),
    value: [{ text: 'D' }, 'd1', 'd2'],
    depth: 2,
  }
  const e: CoreNode = {
    id: 'E',
    parent: 'A',
    children: new Set(),
    value: [{ text: 'E' }, 'e1', 'e2'],
    depth: 1,
  }

  nodeMap.set('A', a)
  nodeMap.set('B', b)
  nodeMap.set('C', c)
  nodeMap.set('D', d)
  nodeMap.set('E', e)

  const rootIds = new Set<NodeId>(['A'])

  return { nodeMap, rootIds, columns }
}

function createTestEngine(): TreeDataEngine {
  return new TreeDataEngine({
    initData: createInitData,
  })
}

describe('TreeDataEngine', () => {
  describe('add-node', () => {
    it('adds root node and updates rootIds and nodeMap', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()

      api.apply({
        type: 'add-node',
        payload: { parentId: null, node: { id: 'ROOT2', value: ['NewRoot', 'x', 'y'] } },
      })

      const core = engine.getCoreState()
      expect(core.rootIds.has('ROOT2')).toBe(true)
      const node = core.nodeMap.get('ROOT2')
      expect(node).toBeDefined()
      expect(node!.parent).toBeNull()
      expect(node!.depth).toBe(0)
      expect(node!.children.size).toBe(0)
    })

    it('adds child node with correct parent and depth', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()

      api.apply({
        type: 'add-node',
        payload: { parentId: 'B', node: { id: 'F', value: ['F', 'f1', 'f2'] } },
      })

      const core = engine.getCoreState()
      const child = core.nodeMap.get('F')
      expect(child).toBeDefined()
      expect(child!.parent).toBe('B')
      expect(child!.depth).toBe(2)

      const parent = core.nodeMap.get('B')
      expect(parent!.children.has('F')).toBe(true)
    })

    it('add-node without parentId uses null and creates root', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()

      api.apply({
        type: 'add-node',
        payload: { node: { id: 'ROOT3', value: ['R', 'r1', 'r2'] } },
      })

      const core = engine.getCoreState()
      expect(core.nodeMap.get('ROOT3')!.parent).toBeNull()
      expect(core.rootIds.has('ROOT3')).toBe(true)
    })
  })

  describe('remove-node', () => {
    it('removes leaf node and cleans parent children', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()

      api.apply({ type: 'remove-node', payload: { id: 'E' } })

      const core = engine.getCoreState()
      expect(core.nodeMap.has('E')).toBe(false)
      expect(core.nodeMap.get('A')!.children.has('E')).toBe(false)
    })

    it('removes node with subtree and clears all descendants from nodeMap', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()

      api.apply({ type: 'remove-node', payload: { id: 'B' } })

      const core = engine.getCoreState()
      expect(core.nodeMap.has('B')).toBe(false)
      expect(core.nodeMap.has('C')).toBe(false)
      expect(core.nodeMap.has('D')).toBe(false)
      expect(core.nodeMap.get('A')!.children.has('B')).toBe(false)
    })

    it('removing last root clears rootIds', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      api.apply({ type: 'remove-node', payload: { id: 'B' } })
      api.apply({ type: 'remove-node', payload: { id: 'E' } })
      api.apply({ type: 'remove-node', payload: { id: 'A' } })

      const core = engine.getCoreState()
      expect(core.rootIds.size).toBe(0)
      expect(core.nodeMap.size).toBe(0)
    })

    it('removed node is not present in nodeMap', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()

      api.apply({ type: 'remove-node', payload: { id: 'C' } })

      const core = engine.getCoreState()
      expect(core.nodeMap.has('C')).toBe(false)
      expect(core.nodeMap.get('B')!.children.has('C')).toBe(false)
    })
  })

  describe('expand / collapse / toggle-expand', () => {
    it('expanded is updated when node is expanded', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      const vs = engine.getViewState()!
      const nodeA = vs.nodes.find((n) => n.id === 'A')
      expect(nodeA!.expanded).toBe(true)
    })

    it('expanded is updated when node is collapsed', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'collapse-node', payload: { id: 'A' } })

      const vs = engine.getViewState()!
      const nodeA = vs.nodes.find((n) => n.id === 'A')
      expect(nodeA!.expanded).toBe(false)
    })

    it('node without children does not expand', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({ type: 'expand-node', payload: { id: 'E' } })
      const vs = engine.getViewState()!
      const nodeE = vs.nodes.find((n) => n.id === 'E')
      expect(nodeE!.expanded).toBe(false)
    })

    it('toggle-expand expands then collapses idempotently', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({ type: 'toggle-expand', payload: { id: 'A' } })
      let vs = engine.getViewState()!
      expect(vs.nodes.find((n) => n.id === 'A')!.expanded).toBe(true)

      api.apply({ type: 'toggle-expand', payload: { id: 'A' } })
      vs = engine.getViewState()!
      expect(vs.nodes.find((n) => n.id === 'A')!.expanded).toBe(false)

      api.apply({ type: 'toggle-expand', payload: { id: 'A' } })
      api.apply({ type: 'toggle-expand', payload: { id: 'A' } })
      vs = engine.getViewState()!
      expect(vs.nodes.find((n) => n.id === 'A')!.expanded).toBe(false)
    })
  })

  describe('ViewState and linearNodes', () => {
    it('nodes order follows depth-first traversal', () => {
      const engine = createTestEngine()
      engine.getViewState()
      const api = engine.getAPI()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'expand-node', payload: { id: 'B' } })
      const vs = engine.getViewState()!
      const ids = vs.nodes.map((n) => n.id)
      expect(ids).toEqual(['A', 'B', 'C', 'D', 'E'])
    })

    it('each node has correct depth, hasChildren, expanded, subtreeSize', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'expand-node', payload: { id: 'B' } })
      const vs = engine.getViewState()!

      const byId = (id: string) => vs.nodes.find((n) => n.id === id)!

      expect(byId('A').depth).toBe(0)
      expect(byId('A').hasChildren).toBe(true)
      expect(byId('A').expanded).toBe(true)
      expect(byId('A').subtreeSize).toBe(5)

      expect(byId('B').depth).toBe(1)
      expect(byId('B').hasChildren).toBe(true)
      expect(byId('B').subtreeSize).toBe(3)

      expect(byId('C').depth).toBe(2)
      expect(byId('C').hasChildren).toBe(false)
      expect(byId('C').subtreeSize).toBe(1)

      expect(byId('E').depth).toBe(1)
      expect(byId('E').hasChildren).toBe(false)
      expect(byId('E').subtreeSize).toBe(1)
    })

    it('visibleNodesIndexes contains only visible nodes in order', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      const vs = engine.getViewState()!

      const visible = vs.visibleNodesIndexes.map((i) => vs.nodes[i])
      expect(visible.every((n) => n.visible)).toBe(true)
      expect(visible.map((n) => n.id)).toEqual(['A'])
    })

    it('visibleNodesIndexes updates after expand and collapse', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      let vs = engine.getViewState()!
      expect(vs.visibleNodesIndexes.length).toBe(1)

      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      vs = engine.getViewState()!
      expect(vs.visibleNodesIndexes.length).toBe(3)
      expect(vs.visibleNodesIndexes.map((i) => vs.nodes[i].id).sort()).toEqual(['A', 'B', 'E'])

      api.apply({ type: 'collapse-node', payload: { id: 'A' } })
      vs = engine.getViewState()!
      expect(vs.visibleNodesIndexes.length).toBe(1)
    })
  })

  describe('Incremental updates', () => {
    it('expand-node shows only direct children; grandchildren hidden when parent collapsed', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      let vs = engine.getViewState()!
      let visibleIds = vs.visibleNodesIndexes.map((i) => vs.nodes[i].id)
      expect(visibleIds).toContain('A')
      expect(visibleIds).toContain('B')
      expect(visibleIds).toContain('E')
      expect(visibleIds).not.toContain('C')
      expect(visibleIds).not.toContain('D')

      api.apply({ type: 'expand-node', payload: { id: 'B' } })
      vs = engine.getViewState()!
      visibleIds = vs.visibleNodesIndexes.map((i) => vs.nodes[i].id)
      expect(visibleIds).toContain('C')
      expect(visibleIds).toContain('D')
    })

    it('collapse-node hides all descendants and visibleNodesIndexes shrinks', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'expand-node', payload: { id: 'B' } })

      let vs = engine.getViewState()!
      expect(vs.visibleNodesIndexes.length).toBe(5)

      api.apply({ type: 'collapse-node', payload: { id: 'A' } })
      vs = engine.getViewState()!
      expect(vs.visibleNodesIndexes.length).toBe(1)
      vs.visibleNodesIndexes.forEach((i) => expect(vs.nodes[i].visible).toBe(true))
    })

    it('set-node-visibility hide root hides only that root in view', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({ type: 'set-node-visibility', payload: { id: 'A', visible: false } })
      const vs = engine.getViewState()!
      const nodeA = vs.nodes.find((n) => n.id === 'A')
      expect(nodeA!.visible).toBe(false)
      expect(vs.visibleNodesIndexes.some((i) => vs.nodes[i].id === 'A')).toBe(false)
    })

    it('set-node-visibility hide parent hides whole subtree', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'expand-node', payload: { id: 'B' } })

      api.apply({ type: 'set-node-visibility', payload: { id: 'B', visible: false } })
      const vs = engine.getViewState()!
      expect(vs.nodes.find((n) => n.id === 'B')!.visible).toBe(false)
      expect(vs.nodes.find((n) => n.id === 'C')!.visible).toBe(false)
      expect(vs.nodes.find((n) => n.id === 'D')!.visible).toBe(false)
      const visibleIds = vs.visibleNodesIndexes.map((i) => vs.nodes[i].id)
      expect(visibleIds).not.toContain('B')
      expect(visibleIds).not.toContain('C')
      expect(visibleIds).not.toContain('D')
    })

    it('set-node-visibility show again restores node and respects expanded', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'set-node-visibility', payload: { id: 'B', visible: false } })

      api.apply({ type: 'set-node-visibility', payload: { id: 'B', visible: true } })
      const vs = engine.getViewState()!
      expect(vs.nodes.find((n) => n.id === 'B')!.visible).toBe(true)
      const visibleIds = vs.visibleNodesIndexes.map((i) => vs.nodes[i].id)
      expect(visibleIds).toContain('B')
    })
  })

  describe('Columns and Cells', () => {
    it('set-column-visibility hides column from viewState.columns', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      let vs = engine.getViewState()!
      expect(vs.columns.length).toBe(3)

      api.apply({
        type: 'set-column-visibility',
        payload: { index: 1, id: 'col1', visible: false },
      })
      vs = engine.getViewState()!
      expect(vs.columns.length).toBe(2)
      expect(vs.columns.some((c) => c.id === 'col1')).toBe(false)
    })

    it('column order is preserved when some columns hidden', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({
        type: 'set-column-visibility',
        payload: { index: 1, id: 'col1', visible: false },
      })
      const vs = engine.getViewState()!
      expect(vs.columns.map((c) => c.id)).toEqual(['col0', 'col2'])
    })

    it('first column cell uses tree/cell, others use text', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      const vs = engine.getViewState()!

      const firstNode = vs.nodes[0]!
      expect(firstNode.cells[0].renderer).toBe('tree/cell')
      expect(firstNode.cells[0].payload.depth).toBeDefined()
      expect(firstNode.cells[0].payload.hasChildren).toBeDefined()
      if (firstNode.cells[1]) {
        expect(firstNode.cells[1].renderer).toBe('text')
      }
    })

    it('hidden columns do not create cells', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({
        type: 'set-column-visibility',
        payload: { index: 1, id: 'col1', visible: false },
      })
      const vs = engine.getViewState()!
      const firstNode = vs.nodes[0]!
      expect(firstNode.cells.length).toBe(2)
    })
  })

  describe('Edge cases', () => {
    it('expand then hide then show then collapse leaves consistent state', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'set-node-visibility', payload: { id: 'B', visible: false } })
      api.apply({ type: 'set-node-visibility', payload: { id: 'B', visible: true } })
      api.apply({ type: 'collapse-node', payload: { id: 'A' } })

      const vs = engine.getViewState()!
      expect(vs.nodes.find((n) => n.id === 'A')!.expanded).toBe(false)
      expect(vs.visibleNodesIndexes.length).toBe(1)
      vs.visibleNodesIndexes.forEach((i) => {
        expect(vs.nodes[i].visible).toBe(true)
      })
    })

    it('collapsing parent with expanded child hides descendants', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'expand-node', payload: { id: 'B' } })

      api.apply({ type: 'collapse-node', payload: { id: 'A' } })
      const vs = engine.getViewState()!
      expect(vs.visibleNodesIndexes.map((i) => vs.nodes[i].id)).toEqual(['A'])
    })

    it('removing expanded node updates view and core', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()
      api.apply({ type: 'expand-node', payload: { id: 'A' } })

      api.apply({ type: 'remove-node', payload: { id: 'B' } })
      const core = engine.getCoreState()
      expect(core.nodeMap.has('B')).toBe(false)
      expect(core.nodeMap.has('C')).toBe(false)
      expect(core.nodeMap.has('D')).toBe(false)

      const vs = engine.getViewState()!
      expect(vs.nodes.some((n) => n.id === 'B')).toBe(false)
      expect(vs.visibleNodesIndexes.every((i) => vs.nodes[i].id !== 'B')).toBe(true)
    })

    it('hide node then remove node does not leave stale visibility state', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()
      engine.getViewState()

      api.apply({ type: 'set-node-visibility', payload: { id: 'A', visible: false } })
      api.apply({ type: 'remove-node', payload: { id: 'A' } })

      const core = engine.getCoreState()
      expect(core.nodeMap.has('A')).toBe(false)
      expect(core.rootIds.size).toBe(0)
      const vs = engine.getViewState()!
      expect(vs.nodes.length).toBe(0)
      expect(vs.visibleNodesIndexes.length).toBe(0)
    })

    it('multiple operations without intermediate getViewState produce correct final view', () => {
      const engine = createTestEngine()
      const api = engine.getAPI()

      api.apply({ type: 'expand-node', payload: { id: 'A' } })
      api.apply({ type: 'expand-node', payload: { id: 'B' } })
      api.apply({ type: 'collapse-node', payload: { id: 'B' } })
      api.apply({ type: 'set-node-visibility', payload: { id: 'E', visible: false } })

      const vs = engine.getViewState()!
      const visibleIds = vs.visibleNodesIndexes.map((i) => vs.nodes[i].id)
      expect(visibleIds).toContain('A')
      expect(visibleIds).toContain('B')
      expect(visibleIds).not.toContain('E')
      expect(visibleIds).not.toContain('C')
      expect(visibleIds).not.toContain('D')
    })
  })
})
