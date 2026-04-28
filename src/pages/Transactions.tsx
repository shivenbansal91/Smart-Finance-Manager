import { useEffect, useMemo, useState } from "react";
import { api, Transaction, Account, Category } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download, Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export default function Transactions() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [accts, setAccts] = useState<Account[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const EMPTY_FORM = {
    amount: "", account_id: "", category_id: "",
    txn_date: new Date().toISOString().slice(0, 10), description: ""
  };
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    const [{ data: t }, { data: a }, { data: c }] = await Promise.all([
      api.transactions.list(),
      api.accounts.list(),
      api.categories.list(),
    ]);
    setTxns(t ?? []); setAccts(a ?? []); setCats(c ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const resetForm = () => setForm({ ...EMPTY_FORM, txn_date: new Date().toISOString().slice(0, 10) });

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) resetForm(); // always clear form on close
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await api.transactions.create({
      account_id: Number(form.account_id),
      category_id: Number(form.category_id),
      amount: Number(form.amount),
      txn_date: form.txn_date,
      description: form.description || undefined,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Transaction added");
      setOpen(false);
      // resetForm() is called by handleOpenChange when open → false
      load();
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await api.transactions.remove(id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const filtered = useMemo(() => txns.filter((t) =>
    !q || t.description?.toLowerCase().includes(q.toLowerCase()) || t.category_name?.toLowerCase().includes(q.toLowerCase())
  ), [txns, q]);

  const exportCsv = () => {
    const rows = [["Date", "Description", "Category", "Type", "Account", "Amount"]];
    filtered.forEach((t) => rows.push([t.txn_date, t.description ?? "", t.category_name ?? "", t.category_type ?? "", t.account_name ?? "", String(t.amount)]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `transactions-${Date.now()}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">Transactions</h1>
          <p className="text-muted-foreground">All your income and expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4" /> CSV</Button>
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild><Button variant="hero"><Plus className="w-4 h-4" /> Add</Button></DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>New transaction</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div><Label>Amount</Label><Input required type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Account</Label>
                  <Select required value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick account" /></SelectTrigger>
                    <SelectContent>{accts.map(a => <SelectItem key={a.account_id} value={String(a.account_id)}>{a.account_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Category</Label>
                  <Select required value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
                    <SelectContent>{cats.map(c => <SelectItem key={c.category_id} value={String(c.category_id)}>{c.icon} {c.name} · {c.type}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional note" /></div>
                <Button variant="hero" className="w-full" disabled={!accts.length || !cats.length}>Add transaction</Button>
                {(!accts.length || !cats.length) && <p className="text-xs text-warning">Create at least one account and category first.</p>}
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search transactions…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No transactions yet</div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((t) => {
              const isInc = t.category_type === "income";
              return (
                <div key={t.transaction_id} className="flex items-center gap-4 p-4 hover:bg-card/50 transition group">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg ${isInc ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {t.category_icon ?? (isInc ? <ArrowUpRight /> : <ArrowDownRight />)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.description || t.category_name}</div>
                    <div className="text-xs text-muted-foreground">{t.category_name} · {t.account_name} · {fmtDate(t.txn_date)}</div>
                  </div>
                  <div className={`font-display font-bold ${isInc ? "text-success" : "text-destructive"}`}>
                    {isInc ? "+" : "−"}{fmtMoney(t.amount)}
                  </div>
                  <button onClick={() => remove(t.transaction_id)} className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
