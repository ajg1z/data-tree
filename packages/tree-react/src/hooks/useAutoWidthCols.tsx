import { useCallback, useEffect, useRef } from "react"
import { useMeasureCellWidth } from "./useColumnAutoSize/hooks/useMeasureCellWidth"
import { cellDefaultWidth, headerDefaultWidth } from "./useColumnAutoSize/constants"
import type { LinearNode, ViewColumn } from "@ajgiz/tree-core"
import debounce from 'lodash/debounce'

interface UseAutoWidthColsProps {
    columns: ViewColumn[]
    visibleRows: LinearNode[]
    minWidth?: number
    maxWidth?: number
    cellPadding?: number
    headerPadding?: number
    onAutoWidthsChange?: (autoWidths: Record<number, number>, indexes: number[]) => void,
    isScrolling?: boolean
    paddingLeft?: number
}
export const useAutoWidthCols = ({
    columns,
    visibleRows,
    minWidth = 40,
    maxWidth = 800,
    cellPadding = 24,
    headerPadding = 0,
    onAutoWidthsChange,
    paddingLeft = 0,
    isScrolling = false,
}: UseAutoWidthColsProps) => {
    const cachedColumns = useRef<Record<number, number>>({})

    const measureCellWidth = useMeasureCellWidth({ paddingLeft })

    const run = useCallback(debounce(async () => {
        if (isScrolling) {
            return
        }
        const autoWidthIndexes: number[] = []

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i]
            if (column?.isAutoWidth) {
                autoWidthIndexes.push(i)
            }
        }

        const nextWidths: Record<number, number> = {}

        for (const index of autoWidthIndexes) {
            const column = columns[index]
            let maxWidthValue = 0

            if (column) {
                try {
                    const headerWidth = await measureCellWidth({
                        cellType: 'column-header',
                        text: column.text ?? '',
                    })
                    maxWidthValue = Math.max(maxWidthValue, headerWidth + headerPadding)
                } catch {
                    maxWidthValue = Math.max(maxWidthValue, headerDefaultWidth + headerPadding)
                }
            }

            for (const row of visibleRows) {
                const cell = row.cells[index]
                if (!cell) {
                    continue
                }

                try {
                    const cellWidth = await measureCellWidth({
                        cellType: index === 0 ? 'cell-header' : 'cell',
                        text: cell.payload?.text ?? '',
                        depth: cell.payload?.depth ?? 0,
                    })
                  
                    maxWidthValue = Math.max(maxWidthValue, cellWidth)
                } catch {
                    maxWidthValue = Math.max(maxWidthValue, cellDefaultWidth)
                }
            }

            if (maxWidthValue <= 0) {
                maxWidthValue = cellDefaultWidth
            }

            nextWidths[index] = Math.round(Math.min(Math.max(maxWidthValue, minWidth), maxWidth))
            cachedColumns.current[index] = nextWidths[index]
        }

        onAutoWidthsChange?.(nextWidths, autoWidthIndexes)
    }, 100), [columns, measureCellWidth, minWidth, maxWidth, cellPadding, headerPadding, visibleRows, isScrolling])

    useEffect(() => {
        if (isScrolling) {
            return
        }
        run()
        return () => {
            run.cancel()
        }
    }, [columns.length, visibleRows, isScrolling, run])
}