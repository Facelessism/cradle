/**
 * Emits a structured diagnostic log entry for worker failures without
 * exposing sensitive data.
 *
 * @param {Object} options
 * @param {string} [options.workerName="Worker"] Name of the worker (e.g. "FilterWorker")
 * @param {string} [options.errorType="WorkerError"] Classification of failure
 * @param {string|Error} [options.message="Unknown worker failure"] Error message
 * @param {string} [options.context="unknown"] Operation context (e.g. "onmessage", "onerror", "postMessage")
 * @param {Object} [options.logger=console] Logger implementation
 * @returns {Object} The structured log object
 */
export function logWorkerFailure({
  workerName = "Worker",
  errorType = "WorkerError",
  message = "Unknown worker failure",
  context = "unknown",
  logger = console,
} = {}) {
  const safeMessage =
    typeof message === "string"
      ? message
      : message?.message || String(message);

  const logEntry = {
    workerName: String(workerName),
    errorType: String(errorType),
    message: safeMessage,
    timestamp: new Date().toISOString(),
    context: String(context),
  };

  if (logger && typeof logger.error === "function") {
    logger.error("[WorkerFailure]", logEntry);
  }

  return logEntry;
}
