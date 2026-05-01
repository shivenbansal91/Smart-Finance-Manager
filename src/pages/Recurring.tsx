import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Repeat, Search, ToggleLeft, ToggleRight, Trash2,
  CalendarClock, Plus, CheckCircle2, AlertCircle, Clock,
  IndianRupee, RotateCcw, X,
} from "lucide-react";
import { api, Subscription, Bill } from "@/lib/api";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function daysSince(d: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
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
      bill_name: form.bill_name, amount: Number(form.amount),
      due_date: form.due_date, recurrence: form.recurrence,
      reminder_days: Number(form.reminder_days),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bill added!");
    onAdded(); onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass rounded-2xl border border-border/60 w-full max-w-md shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h2 className="font-semibold text-base">Add Bill Reminder</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {[
            { label: "Bill Name", key: "bill_name", placeholder: "e.g. Electricity, Netflix" },
            { label: "Amount (₹)", key: "amount", type: "number", placeholder: "1500" },
            { label: "Due Date", key: "due_date", type: "date" },
          ].map(({ label, key, type = "text", placeholder = "" }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <input type={type} value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Recurrence</label>
            <select value={form.recurrence} onChange={e => set("recurrence", e.target.value)}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {["monthly", "weekly", "yearly", "once"].map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Remind me (days before due)</label>
            <input type="number" value={form.reminder_days} onChange={e => set("reminder_days", e.target.value)} min={1} max={30}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60">
            {saving ? "Saving…" : "Add Bill"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Recurring() {
  const [subs, setSubs]           = useState<Subscription[]>([]);
  const [bills, setBills]         = useState<Bill[]>([]);
  const [dueSoon, setDueSoon]     = useState<Bill[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: subData }, { data: billData }, { data: dueData }] = await Promise.all([
      api.subscriptions.list(),
      api.bills.list(),
      api.bills.due(),
    ]);
    setLoading(false);
    if (subData) { setSubs(subData.subscriptions); setMonthlyTotal(subData.monthlyTotal); }
    if (billData) setBills(billData);
    if (dueData)  setDueSoon(dueData);
  };

  useEffect(() => { load(); }, []);

  const handleDetect = async () => {
    setDetecting(true);
    const { data, error } = await api.subscriptions.detect();
    setDetecting(false);
    if (error) { toast.error(error.message); return; }
    if (data) { toast.success(`Found ${data.detected} pattern(s), ${data.newlyAdded} new.`); load(); }
  };

  const handleToggleSub = async (id: number) => {
    const { error } = await api.subscriptions.toggle(id);
    if (error) { toast.error(error.message); return; }
    setSubs(prev => prev.map(s => s.subscription_id === id ? { ...s, is_active: s.is_active ? 0 : 1 } : s));
  };

  const handleDeleteSub = async (id: number) => {
    if (!confirm("Remove this subscription?")) return;
    const { error } = await api.subscriptions.remove(id);
    if (error) { toast.error(error.message); return; }
    setSubs(prev => prev.filter(s => s.subscription_id !== id));
  };

  const handlePayBill = async (id: number) => {
    const { error } = await api.bills.pay(id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid! Due date advanced for recurring bills.");
    load();
  };

  const handleDeleteBill = async (id: number) => {
    if (!confirm("Delete this bill?")) return;
    const { error } = await api.bills.remove(id);
    if (error) { toast.error(error.message); return; }
    setBills(prev => prev.filter(b => b.bill_id !== id));
  };

  // Monthly cost from bills
  const billsMonthlyCost = bills
    .filter(b => !b.is_paid)
    .reduce((s, b) => {
      if (b.recurrence === "monthly") return s + b.amount;
      if (b.recurrence === "weekly")  return s + b.amount * 4;
      if (b.recurrence === "yearly")  return s + b.amount / 12;
      return s;
    }, 0);
  const totalMonthlyCost = monthlyTotal + billsMonthlyCost;

  const overdueBills  = bills.filter(b => b.is_overdue);
  const unpaidBills   = bills.filter(b => !b.is_paid);
  const activeSubs    = subs.filter(s => s.is_active === 1);

  return (
    <div className="space-y-8">
      {showAddBill && <AddBillDialog onClose={() => setShowAddBill(false)} onAdded={load} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Recurring &amp; Bills</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Subscriptions, bills, and recurring charges in one place
          </p>
        </div>
        <div className="flex gap-2">
          <button id="detect-subs-btn" onClick={handleDetect} disabled={detecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted/30 transition-all disabled:opacity-60">
            <Search className={`w-4 h-4 ${detecting ? "animate-pulse" : ""}`} />
            {detecting ? "Scanning…" : "Detect Subscriptions"}
          </button>
          <button id="add-bill-btn" onClick={() => setShowAddBill(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> Add Bill
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-2 mb-1"><IndianRupee className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Est. Monthly Cost</span></div>
          <div className="text-2xl font-bold font-display">₹{fmt(totalMonthlyCost)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Subs + Bills</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-2 mb-1"><Repeat className="w-4 h-4 text-sky-400" /><span className="text-xs text-muted-foreground">Active Subscriptions</span></div>
          <div className="text-2xl font-bold font-display">{activeSubs.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">₹{fmt(monthlyTotal)}/mo</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-2 mb-1"><CalendarClock className="w-4 h-4 text-amber-400" /><span className="text-xs text-muted-foreground">Unpaid Bills</span></div>
          <div className="text-2xl font-bold font-display">{unpaidBills.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">₹{fmt(billsMonthlyCost)} owed</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-red-400" /><span className="text-xs text-muted-foreground">Overdue / Due Soon</span></div>
          <div className="text-2xl font-bold font-display text-red-400">{overdueBills.length + dueSoon.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Needs attention</div>
        </div>
      </div>

      {/* ── Alerts banner ── */}
      {(dueSoon.length > 0 || overdueBills.length > 0) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <Clock className="w-4 h-4" /> Upcoming &amp; Overdue Bills
          </div>
          <div className="flex flex-wrap gap-2">
            {[...overdueBills, ...dueSoon.filter(b => !b.is_overdue)].map(b => (
              <div key={b.bill_id} className={`flex items-center gap-2 text-xs border rounded-lg px-3 py-1.5 bg-background/40 ${b.is_overdue ? "border-red-500/30 text-red-300" : "border-amber-500/20"}`}>
                {b.is_overdue && <AlertCircle className="w-3 h-3 shrink-0" />}
                <span className="font-medium">{b.bill_name}</span>
                <span className="text-muted-foreground">·</span>
                <span>₹{fmt(b.amount)}</span>
                <span className="text-muted-foreground">·</span>
                <span>{fmtDate(b.due_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div>
      ) : (
        <>
          {/* ── 🔄 Auto-detected Subscriptions ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="w-4 h-4 text-sky-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Auto-detected Subscriptions</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">{subs.length}</span>
            </div>
            {subs.length === 0 ? (
              <div className="glass rounded-2xl border border-border/60 p-8 text-center">
                <Repeat className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No subscriptions found yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add transactions with the same description &amp; amount ~30 days apart, then click "Detect Subscriptions".</p>
              </div>
            ) : (
              <div className="glass rounded-2xl border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Merchant</th>
                      <th className="text-left px-5 py-3">Amount</th>
                      <th className="text-left px-5 py-3">Interval</th>
                      <th className="text-left px-5 py-3">Last Seen</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-right px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {subs.map(s => {
                      const ds = daysSince(s.last_seen);
                      const rarely = ds !== null && ds > 60;
                      return (
                        <tr key={s.subscription_id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5 font-medium">
                            {s.merchant}
                            {rarely && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold">Rarely Used</span>}
                          </td>
                          <td className="px-5 py-3.5 font-mono">₹{fmt(s.amount)}</td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.interval_type === "monthly" ? "bg-sky-500/15 text-sky-300" : "bg-purple-500/15 text-purple-300"}`}>
                              {s.interval_type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">{fmtDate(s.last_seen)}</td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                              {s.is_active ? "Active" : "Paused"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 justify-end">
                              <button id={`toggle-sub-${s.subscription_id}`} onClick={() => handleToggleSub(s.subscription_id)} className="text-muted-foreground hover:text-primary transition-colors">
                                {s.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                              </button>
                              <button id={`delete-sub-${s.subscription_id}`} onClick={() => handleDeleteSub(s.subscription_id)} className="text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 📝 Manually Added Bills ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-4 h-4 text-amber-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Manually Added Bills</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">{bills.length}</span>
            </div>
            {bills.length === 0 ? (
              <div className="glass rounded-2xl border border-border/60 p-8 text-center">
                <CalendarClock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No bills added yet. Click "Add Bill" to get started.</p>
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
                    {[...bills.filter(b => !b.is_paid), ...bills.filter(b => b.is_paid)].map(b => (
                      <tr key={b.bill_id} className={`hover:bg-muted/20 transition-colors ${b.is_overdue ? "bg-red-500/5" : b.is_due_soon && !b.is_paid ? "bg-amber-500/5" : ""}`}>
                        <td className="px-5 py-3.5 font-medium">
                          <div className="flex items-center gap-2">
                            {b.is_overdue && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                            {b.is_due_soon && !b.is_overdue && !b.is_paid && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            {b.bill_name}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono">₹{fmt(b.amount)}</td>
                        <td className={`px-5 py-3.5 ${b.is_overdue ? "text-red-400 font-medium" : ""}`}>{fmtDate(b.due_date)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RECURRENCE_COLORS[b.recurrence] ?? ""}`}>{b.recurrence}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.is_paid ? "bg-emerald-500/15 text-emerald-300" : b.is_overdue ? "bg-red-500/15 text-red-300" : b.is_due_soon ? "bg-amber-500/15 text-amber-300" : "bg-muted text-muted-foreground"}`}>
                            {b.is_paid ? "Paid" : b.is_overdue ? "Overdue" : b.is_due_soon ? "Due Soon" : "Upcoming"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            {!b.is_paid && (
                              <button id={`pay-bill-${b.bill_id}`} onClick={() => handlePayBill(b.bill_id)} title="Mark as Paid" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            {!!b.is_paid && b.recurrence !== "once" && (
                              <span title="Will auto-advance on next payment" className="text-muted-foreground opacity-40"><RotateCcw className="w-4 h-4" /></span>
                            )}
                            <button id={`delete-bill-${b.bill_id}`} onClick={() => handleDeleteBill(b.bill_id)} title="Delete" className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
