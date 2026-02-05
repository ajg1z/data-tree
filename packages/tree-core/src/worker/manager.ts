/**
 * Общий менеджер Web Worker для codeEditor
 * Инициализирует worker один раз и инициализирует плагины из основного потока
 */

interface BaseMessage<T extends string> {
    type: T;
    requestId?: string;
}

interface BaseResponse<T extends string > {
    type: T;
    requestId: string;
    error?: string;
}

type PluginContracts<PluginType extends string> = Record<
    PluginType,
    { request: unknown; response: unknown }
>;

type PluginRequest<
    PluginType extends string,
    Contracts extends PluginContracts<PluginType>,
> = BaseMessage<PluginType> & {
    payload: Contracts[PluginType]['request'];
};

type PluginResponse<
    PluginType extends string,
    Contracts extends PluginContracts<PluginType>,
> = BaseResponse<PluginType> & {
    result: Contracts[PluginType]['response'];
};

export class WorkerManager<
    PluginType extends string,
    Contracts extends PluginContracts<PluginType>,
> {
    private worker: Worker | null = null;
    private url: string | URL ;
    private name: string;
    private pendingRequests = new Map<
        string,
        {
            resolve: (value: PluginResponse<PluginType, Contracts>) => void;
            reject: (error: Error) => void;
        }
    >();
    public isInitialized = false;

    constructor( url: string | URL, name: string, dontInit = false ) {
        this.url = url;
        this.name = name;

        if (!dontInit) {
            this.init();
        }
    }

    /**
     * Инициализирует worker и плагины (вызывается один раз)
     * @param plugins Массив типов плагинов для инициализации
     */
    init(): void {
        if (this.worker && this.isInitialized) {
            return;
        }

        try {
            this.worker = new Worker(this.url, {
                type: 'module',
                name: this.name
            });

            this.worker.onmessage = (event: MessageEvent<PluginResponse<PluginType, Contracts>>) => {
                const { requestId, error } = event.data;

                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    this.pendingRequests.delete(requestId);

                    if (error) {
                        pending.reject(new Error(error));
                    } else {
                        pending.resolve(event.data);
                    }
                }
            };

            this.worker.onerror = (_error) => {
                // Обрабатываем ошибки worker
                this.pendingRequests.forEach(({ reject }) => {
                    reject(new Error('Worker error'));
                });
                this.pendingRequests.clear();
            };

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize worker:', error);
            this.isInitialized = false;
        }
    }

    /**
     * Отправляет сообщение в worker
     */
    /**
     * Отправляет сообщение в worker.
     * message.payload -> контракт request
     * ответ содержит result -> контракт response
     */
    sendMessage<T extends PluginType>(
        message: PluginRequest<T, Contracts>,
    ): Promise<PluginResponse<T, Contracts>> {
        if (!this.worker) {
            this.init();
        }

        return new Promise<PluginResponse<T, Contracts>>((resolve, reject) => {
            const requestId = `${Date.now()}-${Math.random()}`;
            const messageWithId: PluginRequest<T, Contracts> = { ...message, requestId };

            this.pendingRequests.set(requestId, {
                resolve: (response) => resolve(response as PluginResponse<T, Contracts>),
                reject
            });

            // Отправляем сообщение в worker
            // Все обработчики зарегистрированы в worker файле (codeEditorWorker.ts)
            if (this.worker) {
                this.worker.postMessage(messageWithId);
            } else {
                this.pendingRequests.delete(requestId);
                reject(new Error('Worker not initialized'));
            }
        });
    }

    /**
     * Очищает worker и все pending запросы
     */
    destroy(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingRequests.clear();
    }
}

