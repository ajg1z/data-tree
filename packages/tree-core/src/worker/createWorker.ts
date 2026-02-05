export interface WorkerHandler<M, R> {
    (message: M): Promise<R> | R;
}
  
  export interface WorkerPlugin {
    type: string;
    handler: WorkerHandler<any, any>;
  }
  
  export function createWorker(plugins: WorkerPlugin[]) {
    const handlers = new Map<string, WorkerHandler<any, any>>();
  
    for (const plugin of plugins) {
      handlers.set(plugin.type, plugin.handler);
    }
  
    self.onmessage = async (event: MessageEvent<any>) => {
      const { type, requestId } = event.data;
  
      if (!requestId) return;
  
      const handler = handlers.get(type);
  
      if (!handler) {
        self.postMessage({
          type: `${type}_RESPONSE`,
          requestId,
          error: `Unknown message type: ${type}`
        });
        return;
      }
  
      try {
        const result = await handler(event.data);
  
        self.postMessage({
          ...result,
          requestId
        });
      } catch (err) {
        self.postMessage({
          type: `${type}_RESPONSE`,
          requestId,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    };
  }
  