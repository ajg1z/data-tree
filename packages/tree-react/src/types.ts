import { ReactNode } from "react"
import { ViewCell, ViewColumn, ViewMetadata, LinearNode, EngineAPI } from "@ajgiz/tree-core"

export type CellRenderFn<ViewOpts extends Record<string, any> = Record<string, any>> = (props: {
    cell: ViewCell
    ctx: {
        api: EngineAPI
        row: LinearNode
        column: ViewColumn
        metadata: ViewMetadata<ViewOpts>
    }
}) => ReactNode

export type ColumnRenderFn<ViewOpts extends Record<string, any> = Record<string, any>> = (props: {
    column: ViewColumn
    ctx: { api: EngineAPI, index: number, metadata: ViewMetadata<ViewOpts> }
}) => ReactNode

export type RowRenderFn<ViewOpts extends Record<string, any> = Record<string, any>> = (props: {
    row: LinearNode
    ctx: { api: EngineAPI, metadata: ViewMetadata<ViewOpts>, columns: ViewColumn[], registry: RenderRegistry<ViewOpts> }
}) => ReactNode

export interface RenderRegistry<ViewOpts extends Record<string, any> = Record<string, any>> {
    cell: Map<string, CellRenderFn<ViewOpts>>
    row: Map<string, RowRenderFn<ViewOpts>>
    column: Map<string, ColumnRenderFn<ViewOpts>>
}