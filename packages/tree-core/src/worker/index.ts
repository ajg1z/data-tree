import { WorkerManager } from './manager'
import type {
  CoreNode,
  EngineState,
  EngineStateCore,
  HierarchicalListItem,
  HierarchicalListValue,
  NodeId,
} from '../types'

export class TreeWorkerPlugin  {
  private worker: WorkerManager<'prepare', { prepare: { request: HierarchicalListValue, response: EngineStateCore }}>

  constructor() {
    this.worker = new WorkerManager<'prepare', { prepare: { request: HierarchicalListValue, response: EngineStateCore }}>
    (new URL('./systemWorker.worker.js', import.meta.url), 'systemWorker')
  }

 async prepare( rawData: HierarchicalListValue ): Promise< EngineStateCore > {
    const response = await this.worker.sendMessage({
      type: 'prepare',
      payload: rawData,
    })

    return response.result
  }
}
