export const fmtMoney = (n: number | string | null | undefined, currency = "INR") => {
  const num = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(num || 0);
};

export const fmtDate = (d: string | Date) => {
  // If d is a YYYY-MM-DD string, parse manually to avoid UTC→IST rollback (off-by-one day bug)
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [year, month, day] = d.slice(0, 10).split("-").map(Number);
    const date = new Date(year, month - 1, day); // local midnight — no timezone shift
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
