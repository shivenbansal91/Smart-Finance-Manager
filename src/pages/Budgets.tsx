import { useEffect, useState } from "react";
import { api, Budget, Category } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Target } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [form, setForm] = useState({ category_id: "", limit_amount: "", start_date: firstDay, end_date: lastDay });

  const load = async () => {
    const [{ data: b }, { data: c }] = await Promise.all([
      api.budgets.list(),
      api.categories.list(),
    ]);
    setBudgets(b ?? []);
    setCats((c ?? []).filter(cat => cat.type === "expense"));
  };
  useEffect(() => { if (user) load(); }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await api.budgets.create({
      category_id: Number(form.category_id),
      limit_amount: Number(form.limit_amount),
      start_date: form.start_date,
      end_date: form.end_date,
    });
    if (error) toast.error(error.message);
    else { toast.success("Budget set"); setOpen(false); setForm({ category_id: "", limit_amount: "", start_date: firstDay, end_date: lastDay }); load(); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this budget?")) return;
    const { error } = await api.budgets.remove(id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">Budgets</h1>
          <p className="text-muted-foreground">Set spending limits per category</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ category_id: "", limit_amount: "", start_date: firstDay, end_date: lastDay });
        }}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="w-4 h-4" /> New budget</Button></DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>New budget</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div><Label>Category</Label>
                <Select required value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Expense category" /></SelectTrigger>
                  <SelectContent>{cats.map(c => <SelectItem key={c.category_id} value={String(c.category_id)}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Limit</Label><Input required type="number" step="0.01" min="0.01" value={form.limit_amount} onChange={(e) => setForm({ ...form, limit_amount: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <Button variant="hero" className="w-full" disabled={!cats.length}>Save budget</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-50" />
          No budgets yet. Set one to track spending limits.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const pct = Math.min(100, (Number(b.spent) / Number(b.limit_amount)) * 100);
            const over = Number(b.spent) >= Number(b.limit_amount);
            const warn = pct >= 80;
            return (
              <div key={b.budget_id} className="glass glass-hover rounded-2xl p-6 group">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-2xl mb-1">{b.category_icon}</div>
                    <div className="font-display font-semibold">{b.category_name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(b.start_date)} → {fmtDate(b.end_date)}</div>
                  </div>
                  <button onClick={() => remove(b.budget_id)} className="text-muted-foreground hover:text-destructive transition p-1 rounded-lg hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className={`font-display text-xl font-bold ${over ? "text-destructive" : warn ? "text-warning" : ""}`}>{fmtMoney(b.spent)}</span>
                  <span className="text-sm text-muted-foreground">/ {fmtMoney(b.limit_amount)}</span>
                </div>
                <Progress value={pct} className={over ? "[&>div]:bg-destructive" : warn ? "[&>div]:bg-warning" : "[&>div]:bg-primary"} />
                <div className={`text-xs mt-2 ${over ? "text-destructive" : warn ? "text-warning" : "text-muted-foreground"}`}>
                  {over ? "⚠ Budget exceeded" : warn ? `⚠ ${pct.toFixed(0)}% used` : `${pct.toFixed(0)}% used`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
