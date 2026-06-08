export function printReceiptOnly() {
  document.body.classList.add("receipt-printing");
  const pageStyle = document.createElement("style");
  pageStyle.id = "receipt-print-page-style";
  pageStyle.textContent = "@page { size: A6 landscape; margin: 3mm; }";
  document.head.appendChild(pageStyle);

  const cleanup = () => {
    document.body.classList.remove("receipt-printing");
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
