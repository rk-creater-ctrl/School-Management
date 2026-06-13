export function printReceiptOnly(orientation = "portrait") {
  const printOrientation = normalizePrintOrientation(orientation);
  document.getElementById("receipt-print-page-style")?.remove();
  document.body.classList.add("receipt-printing");
  document.body.classList.add(`receipt-print-${printOrientation}`);
  const pageStyle = document.createElement("style");
  pageStyle.id = "receipt-print-page-style";
  pageStyle.textContent = `@page { size: A4 ${printOrientation}; margin: 10mm; }`;
  document.head.appendChild(pageStyle);

  const cleanup = () => {
    document.body.classList.remove("receipt-printing");
    document.body.classList.remove(`receipt-print-${printOrientation}`);
    pageStyle.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup, { once: true });
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.print();
    });
  });
}

export function downloadReceiptHtml(receiptElement, { filename = "receipt", orientation = "portrait" } = {}) {
  if (!receiptElement) return;

  const printOrientation = normalizePrintOrientation(orientation);
  const receiptHtml = receiptElement.outerHTML;
  const title = sanitizeFilename(filename || "receipt");
  const pageHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 ${printOrientation}; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      font-family: Inter, Arial, sans-serif;
      direction: ltr;
    }
    .receipt-print-area {
      width: ${printOrientation === "landscape" ? "277mm" : "190mm"};
      max-width: 100%;
      margin: 0 0 0 auto;
      padding: 4.5mm;
      color: #0f172a;
      background: #ffffff;
      direction: ltr;
    }
    .receipt-header,
    .receipt-footer {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    .receipt-header {
      align-items: flex-start;
      padding-bottom: 3mm;
      border-bottom: 2px solid #0f766e;
    }
    .receipt-school-brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .receipt-school-brand img,
    .receipt-logo-fallback {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      object-fit: contain;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: #0f766e;
      font-weight: 900;
      background: #f8fafc;
    }
    .receipt-header h2 { margin: 0; font-size: 16px; line-height: 1.1; }
    .receipt-school-description {
      max-width: 122mm;
      margin: 1mm 0;
      color: #475569;
      font-size: 7.5px;
      font-weight: 700;
      line-height: 1.2;
    }
    .receipt-header span,
    .receipt-number span,
    .receipt-note-box span,
    .receipt-signature span {
      display: block;
      color: #64748b;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .receipt-number { min-width: 34mm; text-align: right; }
    .receipt-number strong { display: block; margin-top: 2px; font-size: 10px; word-break: break-word; }
    .receipt-info-grid {
      display: grid;
      grid-template-columns: repeat(${printOrientation === "landscape" ? "5" : "4"}, minmax(0, 1fr));
      gap: 1.7mm 3mm;
      margin: 2.5mm 0 2mm;
    }
    .receipt-info-grid div { display: grid; gap: 1px; padding-bottom: 1.2mm; border-bottom: 1px solid #e2e8f0; }
    .receipt-info-grid span { color: #64748b; font-size: 7.5px; }
    .receipt-info-grid strong { color: #0f172a; font-size: 8.8px; line-height: 1.2; }
    .receipt-lines {
      width: 100%;
      min-width: 0;
      table-layout: fixed;
      border-collapse: collapse;
      margin: 3mm 0 2mm;
      font-size: 9px;
      line-height: 1.15;
    }
    .receipt-lines th,
    .receipt-lines td {
      padding: 1.4mm 2mm;
      border: 1px solid #cbd5e1;
      text-align: left;
      color: #0f172a;
      background: #ffffff;
      word-break: break-word;
    }
    .receipt-lines th { color: #334155; background: #f8fafc; }
    .receipt-lines td:last-child,
    .receipt-lines th:last-child { text-align: right; }
    .receipt-lines tfoot td { font-weight: 800; background: #ecfdf5; }
    .receipt-note-box {
      min-height: 12mm;
      margin-top: 3mm;
      padding: 2mm 2.5mm;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }
    .receipt-note-box p { min-height: 4mm; margin: 0; white-space: pre-wrap; font-size: 9px; line-height: 1.25; }
    .receipt-footer {
      margin-top: 4mm;
      padding-top: 4mm;
      color: #475569;
      border-top: 1px solid #cbd5e1;
      font-size: 9px;
    }
    .receipt-signature { min-width: 34mm; display: grid; gap: 6mm; text-align: center; color: #0f172a; }
    .receipt-signature strong { padding-top: 1.5mm; border-top: 1px solid #475569; font-size: 9px; }
  </style>
</head>
<body>${receiptHtml}</body>
</html>`;

  const blob = new Blob([pageHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function normalizePrintOrientation(orientation) {
  return orientation === "landscape" ? "landscape" : "portrait";
}

function sanitizeFilename(value) {
  return String(value || "receipt")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "receipt";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
