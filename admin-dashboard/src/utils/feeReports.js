const feeMonths = [
  "April",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];

const calendarMonthIndex = {
  April: 3,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
  January: 0,
  February: 1,
  March: 2,
};
const nextYearMonths = new Set(["January", "February", "March"]);

export function extractFeeLedgerRows(feesOrPlan) {
  const fees = Array.isArray(feesOrPlan) ? feesOrPlan : feesOrPlan ? [feesOrPlan] : [];

  return fees.flatMap((fee) =>
    (fee.items || []).flatMap((item) => {
      if (item.mode === "MONTHLY") {
        return (item.months || []).flatMap((month) => {
          const lateFeeAmount = month.status === "Paid"
            ? Number(month.lateFeePaidAmount || month.lateFeeDueAmount || 0)
            : Number(month.lateFeeDueAmount || 0);
          const baseAmount = Number(month.amount || 0);
          const concessionAmount = Number(month.concessionAmount || 0);
          const payableAmount = Math.max(0, baseAmount - concessionAmount) + lateFeeAmount;
          const paidAmount = getEntryPaidAmount(month, payableAmount);
          const dueAmount = isFeeMonthDueNow(month.name, fee.academicYear)
            ? Math.max(0, payableAmount - paidAmount)
            : 0;
          const common = {
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
            baseAmount,
            concessionAmount,
            lateFeeAmount,
            payableAmount,
            amount: paidAmount || payableAmount,
            paidAmount,
            dueAmount,
            status: month.status || "Pending",
            paidDate: month.paidDate || null,
            paymentMode: month.paymentMode || "",
            note: month.paymentNote || "",
            source: "Tuition",
          };

          const payments = Array.isArray(month.payments) ? month.payments.filter((payment) => Number(payment.amount || 0) > 0) : [];
          if (!payments.length) return [common];

          return payments.map((payment, index) => ({
            ...common,
            id: `${common.id}-payment-${payment._id || index}`,
            receiptNo: payment.receiptNo || common.receiptNo,
            amount: Number(payment.amount || 0),
            paidAmount: Number(payment.amount || 0),
            status: "Paid",
            paidDate: payment.paidDate || month.paidDate || null,
            paymentMode: payment.paymentMode || month.paymentMode || "",
            note: payment.note || month.paymentNote || "",
          }));
        });
      }

      const baseAmount = Number(item.amount || 0);
      const concessionAmount = Number(item.concessionAmount || 0);
      const lateFeeAmount = item.status === "Paid"
        ? Number(item.lateFeePaidAmount || item.lateFeeDueAmount || 0)
        : Number(item.lateFeeDueAmount || 0);
      const payableAmount = Math.max(0, baseAmount - concessionAmount) + lateFeeAmount;
      const paidAmount = getEntryPaidAmount(item, payableAmount);
      const dueAmount = isOneTimeItemDueNow(item, fee.academicYear)
        ? Math.max(0, payableAmount - paidAmount)
        : 0;
      const common = {
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
        period: item.applicableMonth || item.label,
        baseAmount,
        concessionAmount,
        lateFeeAmount,
        payableAmount,
        amount: paidAmount || payableAmount,
        paidAmount,
        dueAmount,
        status: item.status || "Pending",
        paidDate: item.paidDate || null,
        paymentMode: item.paymentMode || "",
        note: item.paymentNote || "",
        source: "Other",
      };
      const payments = Array.isArray(item.payments) ? item.payments.filter((payment) => Number(payment.amount || 0) > 0) : [];
      if (!payments.length) return [common];

      return payments.map((payment, index) => ({
        ...common,
        id: `${common.id}-payment-${payment._id || index}`,
        receiptNo: payment.receiptNo || common.receiptNo,
        amount: Number(payment.amount || 0),
        paidAmount: Number(payment.amount || 0),
        status: "Paid",
        paidDate: payment.paidDate || item.paidDate || null,
        paymentMode: payment.paymentMode || item.paymentMode || "",
        note: payment.note || item.paymentNote || "",
      }));
    })
  );
}

export function getPaidFeeRows(feesOrPlan) {
  return extractFeeLedgerRows(feesOrPlan)
    .filter((row) => row.status === "Paid" && row.paidDate)
    .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));
}

export function extractTransportLedgerRows(feesOrPlan) {
  const fees = Array.isArray(feesOrPlan) ? feesOrPlan : feesOrPlan ? [feesOrPlan] : [];

  return fees.flatMap((fee) =>
    (fee.months || []).map((month) => {
      const lateFeeAmount = month.status === "Paid"
        ? Number(month.lateFeePaidAmount || month.lateFeeDueAmount || 0)
        : Number(month.lateFeeDueAmount || 0);
      const baseAmount = Number(month.amount || 0);
      return {
        id: `transport-${fee._id || fee.student}-${month.name}`,
        receiptNo: createTransportReceiptNo(fee, month.name),
        feeId: fee._id,
        studentId: fee.student,
        vehicleId: fee.vehicle,
        studentName: fee.studentName,
        admissionNo: fee.admissionNo,
        className: fee.className,
        academicYear: fee.academicYear,
        vehicleNo: fee.vehicleNo,
        pickupPoint: fee.pickupPoint,
        startDate: fee.startDate,
        label: "Transport Fee",
        type: "TRANSPORT",
        period: month.name,
        baseAmount,
        lateFeeAmount,
        amount: baseAmount + lateFeeAmount,
        status: month.status || "Pending",
        paidDate: month.paidDate || null,
        source: "Transport",
      };
    })
  );
}

export function getPaidTransportRows(feesOrPlan) {
  return extractTransportLedgerRows(feesOrPlan)
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

function getEntryPaidAmount(entry, payableAmount) {
  const paymentsTotal = (entry.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  if (paymentsTotal > 0) return paymentsTotal;
  const storedPaid = Number(entry.amountPaid || 0);
  if (storedPaid > 0) return storedPaid;
  return entry.status === "Paid" ? payableAmount : 0;
}

function isOneTimeItemDueNow(item, academicYear) {
  if (!item?.applicableMonth) return true;
  return isFeeMonthDueNow(item.applicableMonth, academicYear);
}

function isFeeMonthDueNow(monthName, academicYear, asOf = new Date()) {
  if (!feeMonths.includes(monthName)) return true;
  return getAcademicMonthDateRange(monthName, academicYear).from <= normalizeDate(asOf);
}

function getAcademicMonthDateRange(monthName, academicYear) {
  const calendarMonth = calendarMonthIndex[monthName] ?? 0;
  const { startYear, endYear } = getAcademicYearParts(academicYear);
  const calendarYear = nextYearMonths.has(monthName) ? endYear : startYear;

  return {
    from: normalizeDate(new Date(calendarYear, calendarMonth, 1)),
    to: normalizeDate(new Date(calendarYear, calendarMonth + 1, 0)),
  };
}

function getAcademicYearParts(academicYear) {
  const parts = String(academicYear || "").match(/\d{4}/g) || [];
  const startYear = Number(parts[0]) || new Date().getFullYear();
  const endYear = Number(parts[1]) || startYear + 1;
  return { startYear, endYear };
}

function normalizeDate(date) {
  const next = date ? new Date(date) : new Date();
  next.setHours(0, 0, 0, 0);
  return next;
}

function createReceiptNo(fee, item, period) {
  const year = String(fee.academicYear || "YEAR").replace(/\D/g, "").slice(0, 8);
  const admission = String(fee.admissionNo || fee.student || "STD").replace(/\W/g, "").slice(-6);
  const code = String(period || item?._id || "FEE").replace(/\W/g, "").slice(0, 8).toUpperCase();
  return `R-${year}-${admission}-${code}`;
}

function createTransportReceiptNo(fee, period) {
  const year = String(fee.academicYear || "YEAR").replace(/\D/g, "").slice(0, 8);
  const admission = String(fee.admissionNo || fee.student || "STD").replace(/\W/g, "").slice(-6);
  const vehicle = String(fee.vehicleNo || "BUS").replace(/\W/g, "").slice(-6).toUpperCase();
  const code = String(period || "MONTH").replace(/\W/g, "").slice(0, 8).toUpperCase();
  return `TR-${year}-${admission}-${vehicle}-${code}`;
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
