import { isFilterRequest, isFilterResult } from "./messageValidation.js";

const WORKER_URL = "./scripts/worker.js";

/**
 * Create a search worker and turn both startup and runtime failures into a
 * single callback. The caller decides how to recover from the failure.
 */
export function createFilterWorker({ WorkerCtor, onResult, onFailure }) {
  try {
    const worker = new WorkerCtor(WORKER_URL, { type: "module" });
    let failed = false;

    const fail = error => {
      if (failed) return;
      failed = true;
      worker.terminate();
      onFailure(error);
    };

    worker.onmessage = event => {
      if (!isFilterResult(event.data)) {
        fail(new Error("Worker returned an invalid search result"));
        return;
      }

      onResult(event.data);
    };

    worker.onerror = fail;

    return {
      postMessage(message) {
        if (failed) return false;

        if (!isFilterRequest(message)) {
          fail(new Error("Refusing to send an invalid search request"));
          return false;
        }

        try {
          worker.postMessage(message);
          return true;
        } catch (error) {
          fail(error);
          return false;
        }
      },
      terminate() {
        if (!failed) {
          failed = true;
          worker.terminate();
        }
      },
    };
  } catch (error) {
    onFailure(error);
    return null;
  }
}
