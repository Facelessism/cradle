// src/utils/searchWorkerClient.ts

export interface ProjectItem {
    id: string;
    title: string;
    description: string;
    category: string;
}

export class SearchWorkerClient {
    private worker: Worker | null = null;
    private isFallbackActive: boolean = false;
    private fallbackSearchFn: ((query: string, projects: ProjectItem[]) => ProjectItem[]) | null = null;

    constructor(
        workerPath: string = '/src/workers/search.worker.js',
        fallbackFn: (query: string, projects: ProjectItem[]) => ProjectItem[]
    ) {
        this.fallbackSearchFn = fallbackFn;
        this.initWorker(workerPath);
    }

    private initWorker(path: string) {
        try {
            // Attempt to create Web Worker
            this.worker = new Worker(path, { type: 'module' });

            this.worker.onerror = (error) => {
                console.warn('Search Web Worker encountered an error. Falling back to main-thread search.', error);
                this.activateFallback();
            };
        } catch (err) {
            console.warn('Failed to initialize Search Web Worker (CORS or CSP restriction). Using main-thread fallback.', err);
            this.activateFallback();
        }
    }

    private activateFallback() {
        this.isFallbackActive = true;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    /**
     * Executes search via Web Worker if healthy, otherwise runs main-thread fallback.
     */
    public search(
        query: string,
        projects: ProjectItem[],
        callback: (results: ProjectItem[]) => void
    ): void {
        if (this.isFallbackActive || !this.worker) {
            if (this.fallbackSearchFn) {
                const results = this.fallbackSearchFn(query, projects);
                callback(results);
            }
            return;
        }

        // Setup one-time message listener for worker response
        const messageHandler = (e: MessageEvent) => {
            this.worker?.removeEventListener('message', messageHandler);
            callback(e.data);
        };

        this.worker.addEventListener('message', messageHandler);

        // Send search payload to worker
        this.worker.postMessage({ query, projects });
    }

    public terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
