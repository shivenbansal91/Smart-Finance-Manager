import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Landmark, Plus, Wallet, AlertCircle, CheckCircle2,
  Trash2, CreditCard, X,
} from "lucide-react";
import { api, Loan } from "@/lib/api";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const color = status === "closed"
    ? "bg-emerald-500"
    : pct >= 75 ? "bg-emerald-500"
    : pct >= 40 ? "bg-amber-500"
    : "bg-red-500";
  return (
    <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Add Loan Dialog ───────────────────────────────────────────────────────────
function AddLoanDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    lender_name: "", principal: "", interest_rate: "", emi_amount: "", due_date: "", notes: "",
  });
  const [creditAccountId, setCreditAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<{ account_id: number; account_name: string; balance: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.accounts.list().then(({ data }) => { if (data) setAccounts(data); });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lender_name || !form.principal || !form.emi_amount || !form.due_date)
      return toast.error("Lender, principal, EMI amount, and due date are required.");
    setSaving(true);
    const { error } = await api.loans.create({
      lender_name:       form.lender_name,
      principal:         Number(form.principal),
      interest_rate:     form.interest_rate ? Number(form.interest_rate) : 0,
      emi_amount:        Number(form.emi_amount),
      due_date:          form.due_date,
      notes:             form.notes || undefined,
      credit_account_id: creditAccountId ? Number(creditAccountId) : undefined,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(creditAccountId
      ? "Loan added & principal credited to account!"
      : "Loan added!"
    );
    onAdded();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass rounded-2xl border border-border/60 w-full max-w-md shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border/40 sticky top-0 glass z-10">
          <h2 className="font-semibold text-base">Add Loan / Debt</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {[
            { label: "Lender / Bank", key: "lender_name", placeholder: "e.g. HDFC Bank" },
            { label: "Principal Amount (₹)", key: "principal", type: "number", placeholder: "100000" },
            { label: "Interest Rate (%)", key: "interest_rate", type: "number", placeholder: "12.5" },
            { label: "EMI Amount (₹)", key: "emi_amount", type: "number", placeholder: "5000" },
            { label: "Next EMI Due Date", key: "due_date", type: "date" },
          ].map(({ label, key, type = "text", placeholder = "" }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>
          {/* Account credit selector */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <label className="block text-xs font-medium text-primary">
              💳 Credit loan amount to account <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              value={creditAccountId}
              onChange={e => setCreditAccountId(e.target.value)}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— Don&apos;t update any account —</option>
              {accounts.map(a => (
                <option key={a.account_id} value={a.account_id}>
                  {a.account_name} (₹{new Intl.NumberFormat("en-IN").format(a.balance)})
                </option>
              ))}
            </select>
            {creditAccountId && (
              <p className="text-[11px] text-primary/80">
                ₹{form.principal ? new Intl.NumberFormat("en-IN").format(Number(form.principal)) : "0"} will be added to your account balance.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add Loan"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Pay EMI Dialog ────────────────────────────────────────────────────────────
function PayDialog({ loan, onClose, onPaid }: { loan: Loan; onClose: () => void; onPaid: () => void }) {
  const [amount, setAmount]          = useState(String(loan.emi_amount));
  const [debitAccountId, setDebitId] = useState<string>("");
  const [accounts, setAccounts]      = useState<{ account_id: number; account_name: string; balance: number }[]>([]);
  const [saving, setSaving]          = useState(false);

  useEffect(() => {
    api.accounts.list().then(({ data }) => { if (data) setAccounts(data); });
  }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount.");
    setSaving(true);
    const { error } = await api.loans.pay(
      loan.loan_id,
      Number(amount),
      debitAccountId ? Number(debitAccountId) : undefined
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(debitAccountId ? "Payment recorded & deducted from account!" : "Payment recorded!");
    onPaid();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass rounded-2xl border border-border/60 w-full max-w-sm shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h2 className="font-semibold text-base">Record Payment — {loan.lender_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handlePay} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Payment Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {/* Account debit selector */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
            <label className="block text-xs font-medium text-red-400">
              🏦 Debit from account <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              value={debitAccountId}
              onChange={e => setDebitId(e.target.value)}
              className="w-full rounded-xl bg-background border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— Don&apos;t update any account —</option>
              {accounts.map(a => (
                <option key={a.account_id} value={a.account_id}>
                  {a.account_name} (₹{new Intl.NumberFormat("en-IN").format(a.balance)})
                </option>
              ))}
            </select>
            {debitAccountId && (
              <p className="text-[11px] text-red-400/80">
                ₹{amount ? new Intl.NumberFormat("en-IN").format(Number(amount)) : "0"} will be deducted from your account balance.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {saving ? "Saving…" : "Record Payment"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Loan Card ─────────────────────────────────────────────────────────────────
function LoanCard({
  loan,
  onPay,
  onDelete,
}: {
  loan: Loan;
  onPay: (l: Loan) => void;
  onDelete: (id: number) => void;
}) {
  const closed = loan.status === "closed";

  return (
    <div className={`glass rounded-2xl border p-5 space-y-4 transition-all hover:scale-[1.005] ${closed ? "opacity-70 border-emerald-500/20" : "border-border/60"}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">{loan.lender_name}</div>
            <div className="text-xs text-muted-foreground">
              {loan.interest_rate > 0 ? `${loan.interest_rate}% p.a.` : "0% interest"} · EMI ₹{fmt(loan.emi_amount)}/mo
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${closed ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"}`}>
            {closed ? "Closed" : "Active"}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Paid ₹{fmt(loan.paid_amount)}</span>
          <span>{loan.progress_pct}%</span>
          <span>Total ₹{fmt(loan.principal)}</span>
        </div>
        <ProgressBar pct={loan.progress_pct} status={loan.status} />
        <div className="mt-1.5 text-xs font-medium text-right">
          Remaining: <span className="text-foreground">₹{fmt(loan.remaining_balance)}</span>
        </div>
      </div>

      {/* Due date + notes + interest info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Next due: <span className="text-foreground font-medium">{fmtDate(loan.due_date)}</span></span>
        {loan.interest_rate > 0 && (
          <span className="flex items-center gap-1">
            Interest: <span className="text-amber-400 font-medium">{loan.interest_rate}% p.a.</span>
            <span className="text-muted-foreground/60">→</span>
            <span className="text-amber-300 font-medium">₹{fmt(loan.monthly_interest)}/mo this cycle</span>
          </span>
        )}
        {loan.interest_rate > 0 && (
          <span>Total outflow: <span className="text-foreground font-medium">₹{fmt(loan.effective_emi)}/mo</span></span>
        )}
        {loan.notes && <span className="truncate opacity-70">· {loan.notes}</span>}
      </div>

      {/* Actions */}
      {!closed && (
        <div className="flex gap-2 pt-1">
          <button
            id={`pay-loan-${loan.loan_id}`}
            onClick={() => onPay(loan)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" /> Record Payment
          </button>
          <button
            id={`delete-loan-${loan.loan_id}`}
            onClick={() => onDelete(loan.loan_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Loans() {
  const [loans, setLoans]     = useState<Loan[]>([]);
  const [dueSoon, setDueSoon] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [payTarget, setPayTarget] = useState<Loan | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: lData }, { data: dData }] = await Promise.all([
      api.loans.list(), api.loans.due(),
    ]);
    setLoading(false);
    if (lData) setLoans(lData);
    if (dData) setDueSoon(dData);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this loan?")) return;
    const { error } = await api.loans.remove(id);
    if (error) { toast.error(error.message); return; }
    toast.success("Loan deleted.");
    setLoans(prev => prev.filter(l => l.loan_id !== id));
  };

  const activeLoans = loans.filter(l => l.status === "active");
  const closedLoans = loans.filter(l => l.status === "closed");
  const totalDebt   = activeLoans.reduce((s, l) => s + l.remaining_balance, 0);

  return (
    <div className="space-y-8">
      {showAdd && <AddLoanDialog onClose={() => setShowAdd(false)} onAdded={load} />}
      {payTarget && <PayDialog loan={payTarget} onClose={() => setPayTarget(null)} onPaid={load} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Loans &amp; Debt</h1>
          <p className="text-muted-foreground text-sm mt-1">Track EMIs, remaining balances, and upcoming due dates</p>
        </div>
        <button
          id="add-loan-btn"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Loan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-red-400" /><span className="text-xs text-muted-foreground">Total Outstanding</span></div>
          <div className="text-2xl font-bold font-display text-red-400">₹{fmt(totalDebt)}</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-amber-400" /><span className="text-xs text-muted-foreground">Active Loans</span></div>
          <div className="text-2xl font-bold font-display">{activeLoans.length}</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-xs text-muted-foreground">Closed / Paid Off</span></div>
          <div className="text-2xl font-bold font-display">{closedLoans.length}</div>
        </div>
      </div>

      {/* Due soon banner */}
      {dueSoon.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">EMI due in the next 7 days</p>
            <ul className="mt-1 space-y-0.5">
              {dueSoon.map(l => (
                <li key={l.loan_id} className="text-xs text-muted-foreground">
                  {l.lender_name} — ₹{fmt(l.emi_amount)} due {fmtDate(l.due_date)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : loans.length === 0 ? (
        <div className="glass rounded-2xl border border-border/60 p-12 text-center">
          <Landmark className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">No loans tracked yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {loans.map(l => (
            <LoanCard key={l.loan_id} loan={l} onPay={setPayTarget} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
