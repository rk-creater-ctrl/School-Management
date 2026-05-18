export function extractFeeLedgerRows(feesOrPlan) {
  const fees = Array.isArray(feesOrPlan) ? feesOrPlan : feesOrPlan ? [feesOrPlan] : [];

  return fees.flatMap((fee) =>
    (fee.items || []).flatMap((item) => {
      if (item.mode === "MONTHLY") {
        return (item.months || []).map((month) => ({
          id: `${fee._id || fee.student}-${item._id}-${month.name}`,
          receiptNo: createReceiptNo(fee, item, month.name),
          feeId: fee._id,
          studentId: fee.student,
          studentName: fee.studentName,
          admissionNo: fee.admissionNo,
          className: fee.className,
          academicYear: fee.academicYear,
          label: item.label || "Tuition Fee",
          type: item.type || "TUITION",
          period: month.name,
          amount: Number(month.amount || 0),
          status: month.status || "Pending",
          paidDate: month.paidDate || null,
          source: "Tuition",
        }));
      }

      return [
        {
          id: `${fee._id || fee.student}-${item._id}`,
          receiptNo: createReceiptNo(fee, item, item.label),
          feeId: fee._id,
          studentId: fee.student,
          studentName: fee.studentName,
          admissionNo: fee.admissionNo,
          className: fee.className,
          academicYear: fee.academicYear,
          label: item.label,
          type: item.type || "OTHER",
          period: item.label,
          amount: Number(item.amount || 0),
          status: item.status || "Pending",
          paidDate: item.paidDate || null,
          source: "Other",
        },
      ];
    })
  );
}

export function getPaidFeeRows(feesOrPlan) {
  return extractFeeLedgerRows(feesOrPlan)
    .filter((row) => row.status === "Paid" && row.paidDate)
    .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));
}

export function createCollectionSummary(rows) {
  const paidRows = rows.filter((row) => row.status === "Paid" && row.paidDate);
  return {
    weekly: groupByKey(paidRows, (row) => weekKey(new Date(row.paidDate))),
    monthly: buildMonthlySummary(paidRows),
    yearly: groupByKey(paidRows, (row) => String(new Date(row.paidDate).getFullYear())),
  };
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function createReceiptNo(fee, item, period) {
  const year = String(fee.academicYear || "YEAR").replace(/\D/g, "").slice(0, 8);
  const admission = String(fee.admissionNo || fee.student || "STD").replace(/\W/g, "").slice(-6);
  const code = String(period || item?._id || "FEE").replace(/\W/g, "").slice(0, 8).toUpperCase();
  return `R-${year}-${admission}-${code}`;
}

function groupByKey(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    const current = map.get(key) || { label: key, amount: 0, count: 0, rows: [] };
    current.amount += row.amount;
    current.count += 1;
    current.rows.push(row);
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.label.localeCompare(a.label));
}

function buildMonthlySummary(rows) {
  const year = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1);
    return {
      key: `${year}-${String(index + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-IN", { month: "long", year: "numeric" }),
      amount: 0,
      count: 0,
      rows: [],
    };
  });

  rows.forEach((row) => {
    const date = new Date(row.paidDate);
    if (date.getFullYear() !== year) return;
    const bucket = months[date.getMonth()];
    bucket.amount += row.amount;
    bucket.count += 1;
    bucket.rows.push(row);
  });

  return months;
}

function weekKey(date) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
