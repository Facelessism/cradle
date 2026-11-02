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
 * Default configuration for worker retry and exponential backoff.
 */
export const DEFAULT_WORKER_RETRY_CONFIG = Object.freeze({
  maxRetries: 3,
  initialDelayMs: 500,
  backoffFactor: 2,
  maxDelayMs: 4000,
});

/**
 * Calculates exponential backoff delay for a given retry attempt.
 *
 * @param {number} retryCount - Zero-based index of the retry attempt.
 * @param {Object} [config=DEFAULT_WORKER_RETRY_CONFIG] - Backoff timing parameters.
 * @returns {number} Delay in milliseconds clamped to maxDelayMs.
 */
export function calculateBackoffDelay(
  retryCount,
  config = DEFAULT_WORKER_RETRY_CONFIG
) {
  const count = Math.max(0, Number(retryCount) || 0);
  const initial =
    config?.initialDelayMs ?? DEFAULT_WORKER_RETRY_CONFIG.initialDelayMs;
  const factor =
    config?.backoffFactor ?? DEFAULT_WORKER_RETRY_CONFIG.backoffFactor;
  const maxDelay = config?.maxDelayMs ?? DEFAULT_WORKER_RETRY_CONFIG.maxDelayMs;

  const delay = initial * Math.pow(factor, count);
  return Math.min(Math.round(delay), maxDelay);
}

/**
 * Create a search worker and turn both startup and runtime failures into a
 * single callback, optionally supporting retries with exponential backoff.
 * The caller decides how to recover from final failure.
 *
 * @param {Object} options
 * @param {Function} [options.workerFactory] - Custom factory returning a Worker instance.
 * @param {Function} options.onResult - Callback receiving sanitized filter results.
 * @param {Function} options.onFailure - Callback invoked when worker fails (or retries exhausted).
 * @param {Object} [options.logger=console] - Logger for structured failure diagnostics.
 * @param {Object|null} [options.retryConfig=null] - Optional retry and backoff configuration.
 * @param {Function} [options.onRetry=null] - Optional callback notified on each retry attempt.
 * @returns {{postMessage: (message: any) => boolean, terminate: () => void}|null}
 */
export function createFilterWorker({
  workerFactory,
  onResult,
  onFailure,
  logger = console,
  retryConfig = null,
  onRetry = null,
}) {
  const factory = workerFactory || defaultWorkerFactory;
  let retryCount = 0;
  let retryTimer = null;
  let currentWorker = null;
  let terminated = false;

  function cleanupCurrentWorker() {
    if (currentWorker) {
      try {
        currentWorker.terminate();
      } catch (_) {}
      currentWorker = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function instantiate() {
    try {
      const worker = factory();
      let failed = false;

      const fail = (error, context = "onerror", errorType = undefined) => {
        if (failed || terminated) return;
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

        cleanupCurrentWorker();

        // Check if retryConfig is enabled and retry count is below threshold
        const maxRetries = retryConfig?.maxRetries ?? 0;
        const isNonRetryable = errorType === "InvalidRequestError";

        if (retryConfig && !isNonRetryable && retryCount < maxRetries) {
          const delay = calculateBackoffDelay(retryCount, retryConfig);
          retryCount++;
          if (typeof onRetry === "function") {
            try {
              onRetry({
                attempt: retryCount,
                maxRetries,
                delay,
                error,
              });
            } catch (_) {}
          }
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (!terminated) {
              instantiate();
            }
          }, delay);
        } else {
          onFailure(error);
        }
      };

      worker.onmessage = event => {
        if (failed || terminated) return;

        if (!isFilterResult(event.data)) {
          fail(
            new Error("Worker returned an invalid search result"),
            "onmessage",
            "InvalidResultError"
          );
          return;
        }

        // Successful result resets retry counter
        retryCount = 0;

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

      currentWorker = worker;
      return worker;
    } catch (error) {
      logWorkerFailure({
        workerName: "FilterWorker",
        errorType: error?.name || "WorkerInstantiationError",
        message: error?.message || String(error),
        context: "instantiation",
        logger,
      });

      const maxRetries = retryConfig?.maxRetries ?? 0;
      if (retryConfig && retryCount < maxRetries) {
        const delay = calculateBackoffDelay(retryCount, retryConfig);
        retryCount++;
        if (typeof onRetry === "function") {
          try {
            onRetry({
              attempt: retryCount,
              maxRetries,
              delay,
              error,
            });
          } catch (_) {}
        }
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!terminated) {
            instantiate();
          }
        }, delay);
      } else {
        onFailure(error);
      }
      return null;
    }
  }

  const initialWorker = instantiate();
  if (!initialWorker && !retryConfig) {
    return null;
  }

  return {
    postMessage(message) {
      if (terminated) return false;

      if (!isFilterRequest(message)) {
        if (currentWorker) {
          logWorkerFailure({
            workerName: "FilterWorker",
            errorType: "InvalidRequestError",
            message: "Refusing to send an invalid search request",
            context: "postMessage",
            logger,
          });
          cleanupCurrentWorker();
        }
        onFailure(new Error("Refusing to send an invalid search request"));
        return false;
      }

      if (!currentWorker) {
        return false;
      }

      try {
        currentWorker.postMessage(message);
        return true;
      } catch (error) {
        logWorkerFailure({
          workerName: "FilterWorker",
          errorType: "PostMessageError",
          message: error?.message || String(error),
          context: "postMessage",
          logger,
        });
        cleanupCurrentWorker();
        onFailure(error);
        return false;
      }
    },
    terminate() {
      terminated = true;
      cleanupCurrentWorker();
    },
  };
}
