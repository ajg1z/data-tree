import { Fragment, forwardRef, useCallback, useMemo } from 'react'
import type { HTMLAttributes } from 'react'
import type { CoreColumn, CoreNode, EnginePlugin, LinearNode, NodeId } from '@ajgiz/tree-core'
import { TreeDataEngine } from '@ajgiz/tree-core'
import { createDefaultRenderRegistry } from '../registry/RenderRegistry'
import { useTreeDataViewState } from '../hooks/useTreeDataViewState'
import { Virtuoso } from 'react-virtuoso'
import { RenderRegistry } from '../types'
import { useScrolling } from '../hooks/useScrolling'
import { useAutoWidthCols } from '../hooks/useAutoWidthCols'
import cl from './TreeDataList.module.scss'
import cn from 'classnames'

export interface TreeDataListProps<Opts extends Record<string, any> = Record<string, any>, Metadata extends Record<string, any> = Record<string, any>> {
  height?: number
  overscan?: number
  classNames?: {
    root?: string
    header?: string
    list?: string
  }
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
  registry?: RenderRegistry<Metadata>
  options?: Opts & { paddingLeft?: number }
  createNode?: (context: { parentId: NodeId | null, columns: CoreColumn[], payload: { id: NodeId, value: unknown[] } }) => { id: NodeId, parent: NodeId | null, value: unknown[], children?: { id: NodeId, parent: NodeId | null, value: unknown[] }[] },
  plugins?: EnginePlugin[]
}

export const TreeDataList = <Opts extends Record<string, any> = Record<string, any>, Metadata extends Record<string, any> = Record<string, any>>(props: TreeDataListProps<Opts, Metadata>) => {
  const {
    height = 420,
    overscan = 4,
    registry,
    options,
    createNode,
    plugins,
    classNames,
    initData,
    metadata,
  } = props

  const defaultEngine = useMemo(() => new TreeDataEngine<Opts, Metadata>({
    createNode,
    initData,
    options: options ?? {} as Opts,
    plugins: plugins ?? [],
    metadata,
  }), [options, initData, createNode, plugins, metadata])

  const viewState = useTreeDataViewState<Opts, Metadata>(defaultEngine)!

  const api = useMemo(() => defaultEngine.getAPI(), [defaultEngine])

  const resolvedRegistry = useMemo(() => registry ?? createDefaultRenderRegistry<Metadata>(), [registry])

  const { isScrolling, handleScroll } = useScrolling({
    delay: 50,
  })

  const paddingLeft = typeof viewState.options?.paddingLeft === 'number'
    ? viewState.options.paddingLeft
    : 0

  useAutoWidthCols({
    columns: viewState.columns,
    visibleRows: viewState.nodes,
    onAutoWidthsChange: (autoWidths, indexes) => {
      api.apply({
        type: 'set-columns-width',
        payload: { indexes, widths: autoWidths },
      })
    },
    isScrolling,
    paddingLeft,
  })

  const renderRow = useCallback(
    (row: LinearNode) => {

      const Row = resolvedRegistry.row.get('default')
      if (!Row) {
        return null
      }

      return <Row key={row.id} row={row} ctx={{
        api,
        metadata: viewState.metadata,
        columns: viewState.columns,
        registry: resolvedRegistry,
      }} />
    },
    [api, viewState.columns, resolvedRegistry, viewState.metadata],
  )

  if (!viewState) {
    return null
  }

  return (
    <div className={cn(cl.root, classNames?.root)}>
      <div className={cn(cl.header, classNames?.header)}>
        {viewState.columns.map((column, index) =>
          (() => {
            const Column = resolvedRegistry.column.get('default')
            if (!Column) {
              return null
            }

            return (
              <Fragment key={column.id}>
                <Column column={column} ctx={{ api, index, metadata: viewState.metadata }} />
              </Fragment>
            )
          })(),
        )}
      </div>

      <Virtuoso
        style={{ height }}
        className={cn(cl.list, classNames?.list)}
        totalCount={viewState.visibleNodesIndexes.length}
        itemContent={(index) => renderRow(viewState.nodes[viewState.visibleNodesIndexes[index]!]!)}
        computeItemKey={(index) => viewState.visibleNodesIndexes[index] ?? `${index}`}
        overscan={overscan}
        onScroll={handleScroll}
      />
    </div>
  )
}
