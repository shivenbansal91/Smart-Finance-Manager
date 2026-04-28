import { useEffect, useState } from "react";
import { api, Category } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ICONS = ["💼","💻","📈","🍔","🚗","🛍️","💡","🎬","🏥","🎁","✈️","📚","🏠","📱","☕","🎵","💰","🏋️"];

export default function Categories() {
  const { user } = useAuth();
  const [list, setList] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "expense", icon: "💰" });

  const load = async () => {
    const { data } = await api.categories.list();
    setList(data ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await api.categories.create({ name: form.name, type: form.type, icon: form.icon });
    if (error) toast.error(error.message);
    else { toast.success("Category added"); setOpen(false); setForm({ name: "", type: "expense", icon: "💰" }); load(); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this category? Transactions referencing it will block deletion.")) return;
    const { error } = await api.categories.remove(id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const income = list.filter(c => c.type === "income");
  const expense = list.filter(c => c.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">Categories</h1>
          <p className="text-muted-foreground">Organize income &amp; expenses</p>
        </div>
          <Dialog open={open} onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ name: "", type: "expense", icon: "💰" });
        }}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="w-4 h-4" /> New category</Button></DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Groceries" /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Icon</Label>
                <div className="grid grid-cols-9 gap-1 mt-2">
                  {ICONS.map(i => (
                    <button key={i} type="button" onClick={() => setForm({ ...form, icon: i })}
                      className={`text-xl p-2 rounded-lg transition ${form.icon === i ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-card"}`}>{i}</button>
                  ))}
                </div>
              </div>
              <Button variant="hero" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {[
        { title: "Income", items: income, color: "text-success" },
        { title: "Expense", items: expense, color: "text-destructive" },
      ].map((sec) => (
        <div key={sec.title}>
          <h2 className={`font-display font-semibold text-lg mb-3 ${sec.color}`}>{sec.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sec.items.map((c) => (
              <div key={c.category_id} className="glass glass-hover rounded-xl p-4 flex items-center gap-3 group">
                <span className="text-2xl">{c.icon}</span>
                <span className="flex-1 font-medium truncate">{c.name}</span>
                <button onClick={() => remove(c.category_id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {!sec.items.length && <div className="text-sm text-muted-foreground col-span-full">None yet</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
