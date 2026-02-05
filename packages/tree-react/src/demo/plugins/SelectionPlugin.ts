// import type {
//     CoreNode,
//     EnginePlugin,
//     HierarchicalListItem,
//     NodeId,
//     OperationBase,
//     RebuildViewStateEffect,
//     SelectionPluginState,
//     TSelectionBehavior,
//     TSelectionMode,
//     ViewMetadata,
// } from '../types'
// import type { TreeDataEngine } from '../TreeDataEngine'
// import type { SystemOperation } from '../../hierarchicalList/types'
// import { useCallback } from 'react'

// type SelectOperation = OperationBase & {
//     type: 'select'
//     payload: {
//         targetId?: NodeId
//         cellIndex?: number
//         modifiers?: {
//             shift?: boolean
//             ctrl?: boolean
//         }
//     }
// }

// type SelectedNodes = Map<NodeId, number[]>

// type SetSelectionOperation = OperationBase & {
//     type: 'set-selection'
//     payload: {
//         selectionMode?: TSelectionMode
//         selectionBehavior?: TSelectionBehavior
//     }
// }



// export class SelectionPlugin implements EnginePlugin {
//     id = 'selection'

//     init(engine: TreeDataEngine) {
//         engine.initPluginState<SelectionPluginState>(this.id, {
//             selectionMode: 'Single',
//             selectionBehavior: 'SelectRows',
//             selectedItems: new Map<NodeId, number[]>(),
//         })
//     }

//     createNodeRowSelectionState(node: CoreNode, prev?: SelectedNodes) {
//         const newState = new Map(prev);
//         newState.set(
//             node.id,
//             node.value.map((v, index) => index)
//         );
//         return newState;
//     }

//     createColumnSelectionState
//         (selectedNode: CoreNode, index: number, metadata: ViewMetadata, prev?: SelectedNodes) {
//         const parent = selectedNode.parent ? metadata.nodeMap.get(selectedNode.parent) : null;
//         let nodesIds: string[] = [];

//         if (!parent) {
//             nodesIds = metadata.rootIds.map((id) => id);
//         } else {
//             nodesIds = Array.from(parent.children).map((id) => id);
//         }

//         const newState = new Map(prev);
//         const prevNodeIndexes = prev ? (newState.get(selectedNode.id) ?? []) : [];
//         nodesIds.forEach((id) => {
//             newState.set(id, [...prevNodeIndexes, index]);
//         });

//         return newState;
//     }

//     createNodeItemSelectionState
//         (selectedNode: CoreNode, index: number, prev?: SelectedNodes) {
//         const newState = new Map(prev);
//         const prevNodeIndexes = prev ? (newState.get(selectedNode.id) ?? []) : [];
//         newState.set(selectedNode.id, [...prevNodeIndexes, index]);
//         return newState;
//     }

//     handleSelectionBehavior
//         (payload: {
//             selectedNode: CoreNode
//             index?: number
//             metadata: ViewMetadata
//             preservePrevious: boolean
//             selectedItems: Map<NodeId, number[]>
//             selectionBehavior: TSelectionBehavior
//         }) {

//         const { selectedNode, index, metadata, preservePrevious, selectedItems, selectionBehavior } = payload;

//         const updater = (prev?: SelectedNodes) => {
//             switch (selectionBehavior) {
//                 case 'SelectRows':
//                     return this.createNodeRowSelectionState(selectedNode, preservePrevious ? prev : undefined);
//                 case 'SelectColumns':
//                     if (typeof index !== 'number') {
//                         return prev;
//                     }
//                     return this.createColumnSelectionState(selectedNode, index, metadata, preservePrevious ? prev : undefined);
//                 case 'SelectItems':
//                     if (typeof index !== 'number') {
//                         return prev;
//                     }
//                     return this.createNodeItemSelectionState(selectedNode, index, preservePrevious ? prev : undefined);
//             }
//         };

//         return updater(preservePrevious ? selectedItems : undefined);

//     }

//     onOperation(op: OperationBase, engine: TreeDataEngine) {
//         if (op.type === 'set-selection') {
//             const payload = (op as SetSelectionOperation).payload
//             const state = engine.getPluginState<SelectionPluginState>(this.id)
//             if (!state) {
//                 return
//             }

//             engine.setPluginState(this.id, {
//                 selectionMode: payload.selectionMode ?? state.selectionMode,
//                 selectionBehavior: payload.selectionBehavior ?? state.selectionBehavior,
//                 selectedItems: state.selectedItems,
//             })

//             return
//         }

//         if (op.type === 'select') {
//             const payload = (op as SelectOperation).payload
//             const state = engine.getPluginState<SelectionPluginState>(this.id)
//             if (!state) {
//                 return
//             }

//             const selectedNode = payload.targetId ? engine.getViewMetadata()?.nodeMap.get(payload.targetId) : null;
//             if (!selectedNode || !engine.getViewMetadata()) {
//                 return
//             }

//             switch (state.selectionMode) {
//                 case 'NoSelection':
//                     return;
//                 case 'Single':
//                     this.handleSelectionBehavior({ selectedNode, index: payload.cellIndex, metadata: engine.getViewMetadata()!,
//                          preservePrevious: false, selectedItems: state.selectedItems, selectionBehavior: state.selectionBehavior });
//                     break;
//                 case 'Multi':
//                     this.handleSelectionBehavior({ selectedNode, index: payload.cellIndex, metadata: engine.getViewMetadata()!,
//                          preservePrevious: true, selectedItems: state.selectedItems, selectionBehavior: state.selectionBehavior });
//                     break;
//                 case 'Extended': {
//                     if (payload.modifiers?.ctrl) {
//                         this.handleSelectionBehavior({ selectedNode, index: payload.cellIndex, metadata: engine.getViewMetadata()!, 
//                             preservePrevious: true, selectedItems: state.selectedItems, selectionBehavior: state.selectionBehavior });
//                         return;
//                     }

//                     this.handleSelectionBehavior({ selectedNode, index: payload.cellIndex, metadata: engine.getViewMetadata()!,
//                          preservePrevious: false, selectedItems: state.selectedItems, selectionBehavior: state.selectionBehavior });
//                     break;
//                 }
//             }
//         }
//     }

//     run(ctx: { metadata: ViewMetadata; isUpdated: boolean; index: number; originalMetadata: ViewMetadata; effect?: RebuildViewStateEffect },
//         engine: TreeDataEngine): { data: ViewMetadata; isUpdated: boolean } {
//         const state = engine.getPluginState<SelectionPluginState>(this.id)

//         if (!state) {
//             return {
//                 data: ctx.metadata,
//                 isUpdated: ctx.isUpdated,
//             }
//         }

//         return {
//             data: {
//                 ...ctx.metadata,
//                 options: {
//                     ...ctx.metadata.options,
//                     selectedItems: state.selectedItems,
//                     selectionMode: state.selectionMode,
//                     selectionBehavior: state.selectionBehavior,
//                 },
//             },
//             isUpdated: ctx.isUpdated,
//         }
//     }


// }
