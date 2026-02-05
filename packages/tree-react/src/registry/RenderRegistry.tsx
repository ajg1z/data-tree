import { useEffect, type MouseEvent, type ReactNode } from 'react'
import type {
  CellRenderFn,
  ColumnRenderFn,
  RenderRegistry,
  RowRenderFn,
} from '../types'

import { ViewCell } from '@ajgiz/tree-core'
import cn from 'classnames'
import styles from './RenderRegistry.module.scss'

const getPayloadText = (cell: ViewCell) => {
  return cell.payload.text === null || cell.payload.text === undefined ? '' : String(cell.payload.text)
}

const TreeCellContent = ({
  text,
  depth,
  hasChildren,
  expanded,
  disabled,
  onToggleExpand,
  children,
  paddingLeft,
  columnWidth,
}: {
  text: string
  depth: number
  hasChildren: boolean
  expanded: boolean
  disabled: boolean
  onToggleExpand: () => void
  children?: ReactNode
  paddingLeft: number
  columnWidth: number
}) => {
  const displayText = text === '' ? '-' : text

  const handleExpand = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!hasChildren || disabled) {
      return
    }

    onToggleExpand()
  }

  return (
    <div className={styles.hlCellInner} style={{ paddingLeft: depth * paddingLeft, width: columnWidth, maxWidth: columnWidth, minWidth: columnWidth }}>
      <button
        type="button"
        className={cn(styles.hlExpand, {
          [styles.isExpanded]: hasChildren && expanded,
          [styles.isCollapsed]: hasChildren && !expanded,
          [styles.isEmpty]: !hasChildren,
        })}
        onClick={handleExpand}
        aria-label={hasChildren ? 'Toggle expand' : 'No children'}
        disabled={!hasChildren || disabled}
      >
        {hasChildren && <span className={styles.hlExpandIcon} />}
      </button>
      {children}
      <span className={styles.hlCellText}>{displayText}</span>
    </div>
  )
}

const TreeCell: CellRenderFn = ({ cell, ctx }) => {
  const depth = cell.payload.depth ?? ctx.row.depth
  const hasChildren = Boolean(cell.payload.hasChildren)
  const isExpanded = ctx.row.expanded

  return (
    <TreeCellContent
      text={getPayloadText(cell)}
      depth={depth}
      hasChildren={hasChildren}
      expanded={isExpanded}
      disabled={false}
      onToggleExpand={() =>
        ctx.api.apply({ type: isExpanded ? 'collapse-node' : 'expand-node', payload: { id: ctx.row.id } })
      }
      paddingLeft={ctx.metadata.options?.paddingLeft ?? 16}
      columnWidth={ctx.column.width}
    />
  )
}


const TextCell: CellRenderFn = ({ cell, ctx }) => {
  const text = getPayloadText(cell)
  return <span style={{ width: ctx.column.width, maxWidth: ctx.column.width, minWidth: ctx.column.width }} className={styles.hlCellText}>{text === '' ? '-' : text}</span>
}


const Row: RowRenderFn = ({ row, ctx }) => {
  const api = ctx.api
  const columns = ctx.columns
  const registry = ctx.registry
  const metadata = ctx.metadata

  const handleHideNode = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    api.apply({
      type: 'set-node-visibility',
      payload: {
        id: row.id,
        visible: false,
      },
    })
  }


  return (
    <div
      className={cn(styles.hlRow, {
        [styles.isDisabled]: row.disabled,
      })}
    >
      {columns.map((column, index) => {
        if (metadata.hiddenColumns.has(index)) {
          return null
        }

        const cell = row.cells[index]

        if (!cell) {
          return null
        }

        const Cell = registry.cell.get(cell.renderer)
        if (!Cell) {
          return null
        }

        return <Cell key={`${row.id}-${index}`} cell={cell} ctx={{ row, column, api, metadata }} />
      })}

      <button type="button" className={styles.hlRowHide} onClick={handleHideNode}>
        hide
      </button>
    </div>
  )
}

const Column: ColumnRenderFn = ({ column }) => {
  return (
    <div
      className={styles.hlColumnHeader}
      style={{ position: 'relative', width: column.width, maxWidth: column.width, minWidth: column.width }}
    >
      <span>{column.text}</span>
    </div>
  )
}


export const createDefaultRenderRegistry = <T extends Record<string, any> = Record<string, any>>(): RenderRegistry<T> => ({
  cell: new Map<string, CellRenderFn<T>>([
    ['text', TextCell as CellRenderFn<T>],
    ['tree/cell', TreeCell as CellRenderFn<T>],
  ]),
  row: new Map<string, RowRenderFn<T>>([['default', Row as RowRenderFn<T>]]),
  column: new Map<string, ColumnRenderFn<T>>([['default', Column as ColumnRenderFn<T>]]),
})


