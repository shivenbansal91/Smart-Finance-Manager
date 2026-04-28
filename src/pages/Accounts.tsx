import { useEffect, useState } from "react";
import { api, Account } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wallet, CreditCard, Banknote, PiggyBank, Pencil } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";

const TYPES = [
  { v: "bank",    label: "Bank",        icon: Wallet },
  { v: "cash",    label: "Cash",        icon: Banknote },
  { v: "credit",  label: "Credit Card", icon: CreditCard },
  { v: "savings", label: "Savings",     icon: PiggyBank },
];

export default function Accounts() {
  const { user } = useAuth();
  const [list, setList]     = useState<Account[]>([]);
  const [open, setOpen]     = useState(false);
  const [form, setForm]     = useState({ account_name: "", account_type: "bank", balance: "0" });

  // Edit-balance dialog state
  const [editOpen, setEditOpen]       = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [editBalance, setEditBalance] = useState("");

  const load = async () => {
    const { data } = await api.accounts.list();
    setList(data ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  // ── Create new account ────────────────────────────────────────────────────
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await api.accounts.create({
      account_name: form.account_name,
      account_type: form.account_type,
      balance: Number(form.balance),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Account created");
      setOpen(false);
      setForm({ account_name: "", account_type: "bank", balance: "0" });
      load();
    }
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const remove = async (id: number) => {
    if (!confirm("Delete this account and all its transactions?")) return;
    const { error } = await api.accounts.remove(id);
    if (error) toast.error(error.message);
    else { toast.success("Account deleted"); load(); }
  };

  // ── Open edit-balance dialog ──────────────────────────────────────────────
  const openEdit = (a: Account) => {
    setEditAccount(a);
    setEditBalance(String(a.balance));
    setEditOpen(true);
  };

  // ── Save edited balance ───────────────────────────────────────────────────
  const saveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccount) return;
    const newBal = Number(editBalance);
    if (isNaN(newBal)) return toast.error("Enter a valid number");
    const { error } = await api.accounts.updateBalance(editAccount.account_id, newBal);
    if (error) toast.error(error.message);
    else {
      toast.success(`Balance updated to ${fmtMoney(newBal)}`);
      setEditOpen(false);
      setEditAccount(null);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">Accounts</h1>
          <p className="text-muted-foreground">Manage your bank, cash &amp; credit accounts</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ account_name: "", account_type: "bank", balance: "0" }); }}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="w-4 h-4" /> New account</Button></DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div><Label>Name</Label><Input required value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="HDFC Savings" /></div>
              <div><Label>Type</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Starting balance</Label><Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} /></div>
              <Button variant="hero" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Edit balance dialog ──────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditAccount(null); }}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Edit Balance — {editAccount?.account_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveBalance} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set the <strong>current actual balance</strong> of this account. This is useful when setting up
              for the first time or correcting a discrepancy.
            </p>
            <div>
              <Label>Current Balance (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={editBalance}
                onChange={(e) => setEditBalance(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button variant="hero" className="flex-1">Save balance</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {list.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">No accounts yet. Create your first one!</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => {
            const Icon = TYPES.find(t => t.v === a.account_type)?.icon ?? Wallet;
            return (
              <div key={a.account_id} className="glass glass-hover rounded-2xl p-6 flex flex-col gap-3">
                {/* Header row: icon + action buttons */}
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                    <Icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Edit balance */}
                    <button
                      id={`edit-balance-${a.account_id}`}
                      onClick={() => openEdit(a)}
                      title="Edit balance"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {/* Delete */}
                    <button
                      id={`delete-account-${a.account_id}`}
                      onClick={() => remove(a.account_id)}
                      title="Delete account"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Account info */}
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{a.account_type}</div>
                  <div className="font-display font-semibold mb-1">{a.account_name}</div>
                  <div className={`font-display text-2xl font-bold ${Number(a.balance) < 0 ? "text-destructive" : ""}`}>
                    {fmtMoney(a.balance)}
                  </div>
                </div>

                {/* Quick edit balance button */}
                <button
                  onClick={() => openEdit(a)}
                  className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1 w-fit"
                >
                  <Pencil className="w-3 h-3" /> Edit balance
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
