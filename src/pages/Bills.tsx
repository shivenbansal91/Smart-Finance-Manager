import { useEffect, useState } from "react";
import {
  CalendarClock, Plus, CheckCircle2, AlertCircle,
  Clock, Trash2, RotateCcw, X,
} from "lucide-react";
import { api, Bill } from "@/lib/api";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const RECURRENCE_COLORS: Record<string, string> = {
  monthly: "bg-sky-500/15 text-sky-300",
  weekly:  "bg-purple-500/15 text-purple-300",
  yearly:  "bg-emerald-500/15 text-emerald-300",
  once:    "bg-muted text-muted-foreground",
};

// ── Add Bill Dialog ───────────────────────────────────────────────────────────
function AddBillDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    bill_name: "", amount: "", due_date: "",
    recurrence: "monthly" as Bill["recurrence"], reminder_days: "3",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bill_name || !form.amount || !form.due_date)
      return toast.error("Name, amount, and due date are required.");
    setSaving(true);
    const { error } = await api.bills.create({
      bill_name:     form.bill_name,
      amount:        Number(form.amount),
      due_date:      form.due_date,
      recurrence:    form.recurrence,
      reminder_days: Number(form.reminder_days),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bill added!");
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass rounded-2xl border border-border/60 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h2 className="font-semibold text-base">Add Bill Reminder</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Bill Name</label>
            <input
              type="text" value={form.bill_name} onChange={e => set("bill_name", e.target.value)}
              placeholder="e.g. Electricity, Netflix"
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Amount (₹)</label>
            <input
              type="number" value={form.amount} onChange={e => set("amount", e.target.value)}
              placeholder="1500"
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Due Date</label>
            <input
              type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Recurrence</label>
            <select
              value={form.recurrence}
              onChange={e => set("recurrence", e.target.value)}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {["monthly", "weekly", "yearly", "once"].map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Remind me (days before due)</label>
            <input
              type="number" value={form.reminder_days} onChange={e => set("reminder_days", e.target.value)}
              min={1} max={30}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add Bill"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Bill Row ──────────────────────────────────────────────────────────────────
function BillRow({ bill, onPay, onDelete }: { bill: Bill; onPay: (id: number) => void; onDelete: (id: number) => void }) {
  const isPaid    = bill.is_paid === 1;
  const isOverdue = bill.is_overdue;
  const isDueSoon = bill.is_due_soon && !isPaid;

  return (
    <tr className={`hover:bg-muted/20 transition-colors ${isOverdue ? "bg-red-500/5" : isDueSoon ? "bg-amber-500/5" : ""}`}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2 font-medium text-sm">
          {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          {isDueSoon && !isOverdue && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          {bill.bill_name}
        </div>
      </td>
      <td className="px-5 py-3.5 font-mono text-sm">₹{fmt(bill.amount)}</td>
      <td className={`px-5 py-3.5 text-sm ${isOverdue ? "text-red-400 font-medium" : ""}`}>{fmtDate(bill.due_date)}</td>
      <td className="px-5 py-3.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RECURRENCE_COLORS[bill.recurrence] ?? ""}`}>
          {bill.recurrence}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          isPaid    ? "bg-emerald-500/15 text-emerald-300" :
          isOverdue ? "bg-red-500/15 text-red-300" :
          isDueSoon ? "bg-amber-500/15 text-amber-300" :
                      "bg-muted text-muted-foreground"
        }`}>
          {isPaid ? "Paid" : isOverdue ? "Overdue" : isDueSoon ? "Due Soon" : "Upcoming"}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2 justify-end">
          {!isPaid && (
            <button
              id={`pay-bill-${bill.bill_id}`}
              onClick={() => onPay(bill.bill_id)}
              title="Mark as Paid"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {isPaid && bill.recurrence !== "once" && (
            <span title="Will auto-advance on next payment" className="text-muted-foreground">
              <RotateCcw className="w-4 h-4 opacity-40" />
            </span>
          )}
          <button
            id={`delete-bill-${bill.bill_id}`}
            onClick={() => onDelete(bill.bill_id)}
            title="Delete"
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Bills() {
  const [bills, setBills]   = useState<Bill[]>([]);
  const [dueSoon, setDueSoon] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: bData }, { data: dData }] = await Promise.all([
      api.bills.list(), api.bills.due(),
    ]);
    setLoading(false);
    if (bData) setBills(bData);
    if (dData) setDueSoon(dData);
  };

  useEffect(() => { load(); }, []);

  const handlePay = async (id: number) => {
    const { error } = await api.bills.pay(id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid! Due date advanced for recurring bills.");
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this bill?")) return;
    const { error } = await api.bills.remove(id);
    if (error) { toast.error(error.message); return; }
    toast.success("Bill deleted.");
    setBills(prev => prev.filter(b => b.bill_id !== id));
  };

  const unpaid    = bills.filter(b => !b.is_paid);
  const paid      = bills.filter(b => b.is_paid);
  const overdue   = bills.filter(b => b.is_overdue);
  const totalOwed = unpaid.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-8">
      {showAdd && <AddBillDialog onClose={() => setShowAdd(false)} onAdded={load} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Bill Reminders</h1>
          <p className="text-muted-foreground text-sm mt-1">Track upcoming bills and never miss a payment</p>
        </div>
        <button
          id="add-bill-btn"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Bill
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { icon: CalendarClock, color: "text-primary",   bg: "", label: "Total Bills",   val: bills.length.toString() },
          { icon: AlertCircle,   color: "text-red-400",   bg: "", label: "Overdue",       val: overdue.length.toString() },
          { icon: Clock,         color: "text-amber-400", bg: "", label: "Due Soon",      val: dueSoon.length.toString() },
          { icon: CheckCircle2,  color: "text-emerald-400",bg:"",label: "Amount Owed",   val: `₹${fmt(totalOwed)}` },
        ].map(({ icon: Icon, color, label, val }) => (
          <div key={label} className="glass rounded-2xl p-5 border border-border/60">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className="text-2xl font-bold font-display">{val}</div>
          </div>
        ))}
      </div>

      {/* Due-soon banner */}
      {dueSoon.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <Clock className="w-4 h-4" /> Bills Due Soon
          </div>
          <div className="flex flex-wrap gap-3">
            {dueSoon.map(b => (
              <div key={b.bill_id} className="flex items-center gap-2 text-xs bg-background/40 border border-amber-500/20 rounded-lg px-3 py-1.5">
                <span className="font-medium">{b.bill_name}</span>
                <span className="text-muted-foreground">·</span>
                <span>₹{fmt(b.amount)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-amber-300">{fmtDate(b.due_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : bills.length === 0 ? (
        <div className="glass rounded-2xl border border-border/60 p-12 text-center">
          <CalendarClock className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">No bills set up yet. Add one to get started!</p>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-5 py-3">Bill</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Due Date</th>
                <th className="text-left px-5 py-3">Recurrence</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {/* Unpaid first */}
              {unpaid.map(b => (
                <BillRow key={b.bill_id} bill={b} onPay={handlePay} onDelete={handleDelete} />
              ))}
              {/* Then paid */}
              {paid.map(b => (
                <BillRow key={b.bill_id} bill={b} onPay={handlePay} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
