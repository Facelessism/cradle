const invoiceForm = document.getElementById("invoiceForm");
const itemsList = document.getElementById("itemsList");
const itemTemplate = document.getElementById("itemRowTemplate");
const invoicePreview = document.getElementById("invoicePreview");
const headerTotal = document.getElementById("headerTotal");
const statusMessage = document.getElementById("statusMessage");
const templateSelect = document.getElementById("templateSelect");
const currencySelect = document.getElementById("currencySelect");
const logoInput = document.getElementById("logoInput");
const addItemBtn = document.getElementById("addItemBtn");
const inlineAddItemBtn = document.getElementById("inlineAddItemBtn");
const sampleBtn = document.getElementById("sampleBtn");
const printBtn = document.getElementById("printBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const importJsonInput = document.getElementById("importJsonInput");

const STORAGE_KEY = "cradle:invoice-generator";

const sampleInvoice = {
  template: "classic",
  currency: "INR",
  logo: "",
  businessName: "NxtGenSec Studio",
  businessAddress: "Pune, Maharashtra\nIndia\nhello@nxtgensec.example",
  clientName: "Acme Learning Pvt Ltd",
  clientAddress: "Hyderabad, Telangana\nIndia\naccounts@acme.example",
  invoiceNumber: "INV-2026-001",
  issueDate: "2026-07-24",
  dueDate: "2026-08-08",
  taxRate: 18,
  discount: 500,
  shipping: 0,
  paymentTerms: "Payment due within 15 days by bank transfer or UPI.",
  notes: "Thank you for your business. Please mention the invoice number while making payment.",
  items: [
    { description: "Landing page design and responsive build", quantity: 1, rate: 12000 },
    { description: "Invoice and lead management UI setup", quantity: 1, rate: 8500 },
    { description: "Testing, documentation, and deployment support", quantity: 2, rate: 2500 },
  ],
};

document.addEventListener("DOMContentLoaded", initializeInvoiceGenerator);

function initializeInvoiceGenerator() {
  loadInvoice(readSavedInvoice() || sampleInvoice);

  invoiceForm.addEventListener("input", updateInvoice);
  templateSelect.addEventListener("change", updateInvoice);
  currencySelect.addEventListener("change", updateInvoice);
  logoInput.addEventListener("change", handleLogoUpload);
  addItemBtn.addEventListener("click", () => addItem());
  inlineAddItemBtn.addEventListener("click", () => addItem());
  sampleBtn.addEventListener("click", () => loadInvoice(sampleInvoice));
  printBtn.addEventListener("click", printInvoice);
  exportJsonBtn.addEventListener("click", exportInvoiceJson);
  importJsonInput.addEventListener("change", importInvoiceJson);

  updateInvoice();
}

function loadInvoice(invoice) {
  templateSelect.value = invoice.template || "classic";
  currencySelect.value = invoice.currency || "USD";
  setValue("businessName", invoice.businessName);
  setValue("businessAddress", invoice.businessAddress);
  setValue("clientName", invoice.clientName);
  setValue("clientAddress", invoice.clientAddress);
  setValue("invoiceNumber", invoice.invoiceNumber);
  setValue("issueDate", invoice.issueDate);
  setValue("dueDate", invoice.dueDate);
  setValue("taxRate", invoice.taxRate);
  setValue("discount", invoice.discount);
  setValue("shipping", invoice.shipping);
  setValue("paymentTerms", invoice.paymentTerms);
  setValue("notes", invoice.notes);
  logoInput.dataset.logo = invoice.logo || "";

  itemsList.innerHTML = "";
  const items = invoice.items?.length ? invoice.items : [{ description: "", quantity: 1, rate: 0 }];
  items.forEach((item) => addItem(item));
  updateInvoice();
  setStatus("Invoice loaded");
}

function addItem(item = { description: "", quantity: 1, rate: 0 }) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".item-description").value = item.description || "";
  row.querySelector(".item-quantity").value = item.quantity ?? 1;
  row.querySelector(".item-rate").value = item.rate ?? 0;
  row.querySelector(".remove-item").addEventListener("click", () => {
    row.remove();
    if (!itemsList.children.length) addItem();
    updateInvoice();
  });
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateInvoice));
  itemsList.appendChild(row);
  updateInvoice();
}

function updateInvoice() {
  const invoice = collectInvoice();
  const totals = calculateTotals(invoice);
  persistInvoice(invoice);
  renderItemTotals(invoice);
  renderPreview(invoice, totals);
  headerTotal.textContent = formatMoney(totals.total, invoice.currency);
  setStatus("Preview updated");
}

function collectInvoice() {
  return {
    template: templateSelect.value,
    currency: currencySelect.value,
    logo: logoInput.dataset.logo || "",
    businessName: getValue("businessName"),
    businessAddress: getValue("businessAddress"),
    clientName: getValue("clientName"),
    clientAddress: getValue("clientAddress"),
    invoiceNumber: getValue("invoiceNumber"),
    issueDate: getValue("issueDate"),
    dueDate: getValue("dueDate"),
    taxRate: toNumber(getValue("taxRate")),
    discount: toNumber(getValue("discount")),
    shipping: toNumber(getValue("shipping")),
    paymentTerms: getValue("paymentTerms"),
    notes: getValue("notes"),
    items: Array.from(itemsList.children).map((row) => ({
      description: row.querySelector(".item-description").value.trim(),
      quantity: toNumber(row.querySelector(".item-quantity").value),
      rate: toNumber(row.querySelector(".item-rate").value),
    })),
  };
}

function calculateTotals(invoice) {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const discount = Math.min(invoice.discount, subtotal);
  const taxableAmount = Math.max(subtotal - discount, 0);
  const tax = taxableAmount * (invoice.taxRate / 100);
  const total = taxableAmount + tax + invoice.shipping;

  return {
    subtotal,
    discount,
    taxableAmount,
    tax,
    shipping: invoice.shipping,
    total,
  };
}

function renderItemTotals(invoice) {
  Array.from(itemsList.children).forEach((row, index) => {
    const item = invoice.items[index];
    row.querySelector(".item-total").textContent = formatMoney(item.quantity * item.rate, invoice.currency);
  });
}

function renderPreview(invoice, totals) {
  invoicePreview.className = `invoice-preview template-${invoice.template}`;
  const visibleItems = invoice.items.filter((item) => item.description || item.quantity || item.rate);

  invoicePreview.innerHTML = `
    <header class="invoice-top">
      <div class="brand-block">
        ${renderLogo(invoice)}
        <div>
          <h2>${escapeHtml(invoice.businessName || "Your Business")}</h2>
          <p class="address">${escapeHtml(invoice.businessAddress || "Business address")}</p>
        </div>
      </div>
      <div class="invoice-title">
        <h2>Invoice</h2>
        <p class="meta-line"><strong>No:</strong> ${escapeHtml(invoice.invoiceNumber || "INV-001")}</p>
        <p class="meta-line"><strong>Issued:</strong> ${formatDate(invoice.issueDate)}</p>
        <p class="meta-line"><strong>Due:</strong> ${formatDate(invoice.dueDate)}</p>
      </div>
    </header>

    <section class="bill-grid">
      <div>
        <h3>Bill From</h3>
        <p class="address">${escapeHtml(invoice.businessAddress || "Business address")}</p>
      </div>
      <div>
        <h3>Bill To</h3>
        <h2>${escapeHtml(invoice.clientName || "Client Name")}</h2>
        <p class="address">${escapeHtml(invoice.clientAddress || "Client address")}</p>
      </div>
    </section>

    <table class="invoice-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${visibleItems.map((item) => `
          <tr>
            <td>${escapeHtml(item.description || "Invoice item")}</td>
            <td>${formatNumber(item.quantity)}</td>
            <td>${formatMoney(item.rate, invoice.currency)}</td>
            <td>${formatMoney(item.quantity * item.rate, invoice.currency)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <section class="invoice-summary">
      <div class="summary-row"><span>Subtotal</span><strong>${formatMoney(totals.subtotal, invoice.currency)}</strong></div>
      <div class="summary-row"><span>Discount</span><strong>${formatMoney(totals.discount, invoice.currency)}</strong></div>
      <div class="summary-row"><span>Tax (${formatNumber(invoice.taxRate)}%)</span><strong>${formatMoney(totals.tax, invoice.currency)}</strong></div>
      <div class="summary-row"><span>Shipping / fees</span><strong>${formatMoney(totals.shipping, invoice.currency)}</strong></div>
      <div class="summary-row total"><span>Total</span><strong>${formatMoney(totals.total, invoice.currency)}</strong></div>
    </section>

    <footer class="invoice-footer">
      <div>
        <h3>Payment Terms</h3>
        <p>${escapeHtml(invoice.paymentTerms || "Payment due by the invoice due date.")}</p>
      </div>
      <div>
        <h3>Notes</h3>
        <p>${escapeHtml(invoice.notes || "Thank you for your business.")}</p>
      </div>
    </footer>
  `;
}

function renderLogo(invoice) {
  if (invoice.logo) {
    return `<img class="logo-preview" src="${escapeHtml(invoice.logo)}" alt="Business logo" />`;
  }

  const initials = (invoice.businessName || "IN")
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return `<div class="logo-placeholder">${escapeHtml(initials)}</div>`;
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    logoInput.dataset.logo = reader.result;
    updateInvoice();
    setStatus("Logo added");
  };
  reader.readAsDataURL(file);
}

function exportInvoiceJson() {
  downloadFile("invoice-generator-data.json", JSON.stringify(collectInvoice(), null, 2), "application/json");
  setStatus("Invoice JSON exported");
}

function importInvoiceJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const invoice = JSON.parse(reader.result);
      loadInvoice(invoice);
      setStatus("Invoice JSON imported");
    } catch (error) {
      setStatus("Error: Could not import this invoice JSON file.");
    } finally {
      importJsonInput.value = "";
    }
  };
  reader.readAsText(file);
}

function printInvoice() {
  setStatus("Opening print dialog");
  window.print();
}

function persistInvoice(invoice) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoice));
}

function readSavedInvoice() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatMoney(value, currency) {
  if (typeof InvoiceEngine !== "undefined" && typeof InvoiceEngine.formatCurrency === "function") {
    return InvoiceEngine.formatCurrency(value, currency);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getValue(id) {
  return document.getElementById(id).value;
}

function setValue(id, value) {
  document.getElementById(id).value = value ?? "";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function setStatus(message) {
  statusMessage.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    statusMessage.textContent = "Ready";
  }, 1800);
}

function escapeHtml(str) {
  return CradleEscape.escapeHtml(str);
}
