/* =========================================================
   INVOICE GENERATOR — ENGINE MODULE
   Multi-currency formatting, line-item calculations, tax &
   discount management, and invoice storage serialization.
   ========================================================= */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.InvoiceEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CURRENCY_SYMBOLS = Object.freeze({
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    JPY: "¥",
    CAD: "CA$",
    AUD: "A$",
  });

  /** Format amount with currency symbol */
  function formatCurrency(amount, currencyCode = "USD") {
    const symbol = CURRENCY_SYMBOLS[currencyCode] || "$";
    const numeric = typeof amount === "number" && !isNaN(amount) ? amount : 0;
    return `${symbol}${numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** Calculate item line total */
  function calculateLineTotal(quantity = 0, unitPrice = 0) {
    const qty = Math.max(0, Number(quantity) || 0);
    const price = Math.max(0, Number(unitPrice) || 0);
    return qty * price;
  }

  /** Calculate invoice totals summary */
  function calculateInvoiceTotals(items = [], taxRate = 0, discountRate = 0) {
    const subtotal = items.reduce((acc, item) => {
      return acc + calculateLineTotal(item.quantity, item.unitPrice);
    }, 0);

    const taxAmount = (subtotal * Math.max(0, Number(taxRate) || 0)) / 100;
    const discountAmount = (subtotal * Math.max(0, Number(discountRate) || 0)) / 100;
    const grandTotal = Math.max(0, subtotal + taxAmount - discountAmount);

    return {
      subtotal,
      taxAmount,
      discountAmount,
      grandTotal,
    };
  }

  /** Serialize invoice object to JSON for export */
  function serializeInvoice(invoiceData) {
    return JSON.stringify(invoiceData || {}, null, 2);
  }

  /** Deserialize JSON payload */
  function parseInvoiceJSON(jsonString) {
    try {
      return { data: JSON.parse(jsonString), error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  }

  return {
    CURRENCY_SYMBOLS,
    formatCurrency,
    calculateLineTotal,
    calculateInvoiceTotals,
    serializeInvoice,
    parseInvoiceJSON,
  };
});
