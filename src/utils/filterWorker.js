import {
  isFilterRequest,
  isFilterResult,
  sanitizeState,
} from "./messageValidation.js";
import { logWorkerFailure } from "./workerLogger.js";

const WORKER_OPTIONS = { type: "module" };

// Default factory builds a same-origin module worker from the hardcoded literal
// URL below. Keeping the URL literal is what lets the worker-integrity
// validator (scripts/validate-worker-integrity.js) see the reference and check
// that the target script is registered and unmodified.
const defaultWorkerFactory = () =>
  new Worker("./scripts/worker.js", WORKER_OPTIONS);

/**
 * Create a search worker and turn both startup and runtime failures into a
 * single callback. The caller decides how to recover from the failure.
 */
export function createFilterWorker({
  workerFactory,
  onResult,
  onFailure,
  logger = console,
}) {
  try {
    const worker = workerFactory ? workerFactory() : defaultWorkerFactory();
    let failed = false;

    const fail = (error, context = "onerror", errorType = undefined) => {
      if (failed) return;
      failed = true;
      const resolvedErrorType =
        errorType ||
        (error?.name && error.name !== "Error"
          ? error.name
          : "WorkerRuntimeError");
      logWorkerFailure({
        workerName: "FilterWorker",
        errorType: resolvedErrorType,
        message: error?.message || String(error),
        context,
        logger,
      });
      worker.terminate();
      onFailure(error);
    };

    worker.onmessage = event => {
      if (!isFilterResult(event.data)) {
        fail(
          new Error("Worker returned an invalid search result"),
          "onmessage",
          "InvalidResultError"
        );
        return;
      }

      // Hand a produce-free copy to the consumer. Any dangerous key that
      // slipped through validation is stripped so it can never merge into,
      // or otherwise pollute, application state.
      onResult(sanitizeState(event.data));
    };

    worker.onerror = event => {
      const error =
        event instanceof Error
          ? event
          : new Error(event?.message || "Worker runtime error");
      fail(error, "onerror", "WorkerRuntimeError");
    };

    return {
      postMessage(message) {
        if (failed) return false;

        if (!isFilterRequest(message)) {
          fail(
            new Error("Refusing to send an invalid search request"),
            "postMessage",
            "InvalidRequestError"
          );
          return false;
        }

        try {
          worker.postMessage(message);
          return true;
        } catch (error) {
          fail(error, "postMessage", "PostMessageError");
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
    logWorkerFailure({
      workerName: "FilterWorker",
      errorType: error?.name || "WorkerInstantiationError",
      message: error?.message || String(error),
      context: "instantiation",
      logger,
    });
    onFailure(error);
    return null;
  }
}
