export function printReceiptOnly() {
  document.body.classList.add("receipt-printing");
  window.print();
  window.setTimeout(() => {
    document.body.classList.remove("receipt-printing");
  }, 250);
}
