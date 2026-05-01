import { useEffect, useState } from "react";
import { Repeat, Search, Trash2, ToggleLeft, ToggleRight, IndianRupee, Clock } from "lucide-react";
import { api, Subscription } from "@/lib/api";
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

export default function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await api.subscriptions.list();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data) {
      setSubs(data.subscriptions);
      setMonthlyTotal(data.monthlyTotal);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDetect = async () => {
    setDetecting(true);
    const { data, error } = await api.subscriptions.detect();
    setDetecting(false);
    if (error) { toast.error(error.message); return; }
    if (data) {
      toast.success(`Detection complete — ${data.detected} pattern(s) found, ${data.newlyAdded} new.`);
      load();
    }
  };

  const handleToggle = async (id: number) => {
    const { error } = await api.subscriptions.toggle(id);
    if (error) { toast.error(error.message); return; }
    setSubs(prev => prev.map(s => s.subscription_id === id ? { ...s, is_active: s.is_active ? 0 : 1 } : s));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this subscription?")) return;
    const { error } = await api.subscriptions.remove(id);
    if (error) { toast.error(error.message); return; }
    setSubs(prev => prev.filter(s => s.subscription_id !== id));
    toast.success("Subscription removed.");
  };

  const active = subs.filter(s => s.is_active === 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-detected recurring charges from your transactions
          </p>
        </div>
        <button
          id="detect-subscriptions-btn"
          onClick={handleDetect}
          disabled={detecting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60"
        >
          <Search className={`w-4 h-4 ${detecting ? "animate-pulse" : ""}`} />
          {detecting ? "Scanning…" : "Detect Subscriptions"}
        </button>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-3 mb-1">
            <IndianRupee className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-medium">Est. Monthly Cost</span>
          </div>
          <div className="text-2xl font-bold font-display">₹{fmt(monthlyTotal)}</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-3 mb-1">
            <Repeat className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground font-medium">Active</span>
          </div>
          <div className="text-2xl font-bold font-display">{active.length}</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-border/60">
          <div className="flex items-center gap-3 mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-muted-foreground font-medium">Rarely Used (&gt;60 days)</span>
          </div>
          <div className="text-2xl font-bold font-display">
            {subs.filter(s => { const d = daysSince(s.last_seen); return d !== null && d > 60; }).length}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : subs.length === 0 ? (
        <div className="glass rounded-2xl border border-border/60 p-12 text-center">
          <Repeat className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">No subscriptions found yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add some transactions with identical amounts &amp; descriptions, then click "Detect".
          </p>
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
                const rarelyUsed = ds !== null && ds > 60;
                return (
                  <tr key={s.subscription_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium">
                      {s.merchant}
                      {rarelyUsed && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold">
                          Rarely Used
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm">₹{fmt(s.amount)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        s.interval_type === "monthly"
                          ? "bg-sky-500/15 text-sky-300"
                          : "bg-purple-500/15 text-purple-300"
                      }`}>
                        {s.interval_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{fmtDate(s.last_seen)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        s.is_active
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {s.is_active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          id={`toggle-sub-${s.subscription_id}`}
                          onClick={() => handleToggle(s.subscription_id)}
                          title={s.is_active ? "Pause" : "Activate"}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {s.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          id={`delete-sub-${s.subscription_id}`}
                          onClick={() => handleDelete(s.subscription_id)}
                          title="Delete"
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
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
  );
}
