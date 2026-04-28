import { useEffect, useState } from "react";
import { api, DashboardData } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { fmtMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import Loader from "@/components/Loader";
import { toast } from "sonner";

const COLORS = ["hsl(158 84% 52%)", "hsl(268 88% 64%)", "hsl(38 95% 60%)", "hsl(0 84% 62%)", "hsl(220 90% 60%)", "hsl(180 80% 55%)", "hsl(320 80% 60%)"];

interface Stat { label: string; value: string; icon: any; tint: string; }

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stat[]>([]);
  const [byCat, setByCat] = useState<{ name: string; value: number; color: string }[]>([]);
  const [byMonth, setByMonth] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: dash }, { data: als }] = await Promise.all([
      api.dashboard.load(),
      api.alerts.list(),
    ]);

    if (dash) {
      setStats([
        { label: "Total Balance", value: fmtMoney(dash.totalBalance), icon: Wallet, tint: "from-primary/20 to-primary/5" },
        { label: "Income", value: fmtMoney(dash.totalIncome), icon: TrendingUp, tint: "from-success/20 to-success/5" },
        { label: "Expenses", value: fmtMoney(dash.totalExpense), icon: TrendingDown, tint: "from-destructive/20 to-destructive/5" },
        { label: "Savings", value: fmtMoney(Number(dash.totalIncome) - Number(dash.totalExpense)), icon: PiggyBank, tint: "from-accent/20 to-accent/5" },
      ]);
      setByCat(dash.catSpend.map((c, i) => ({ name: c.name, value: Number(c.total), color: COLORS[i % COLORS.length] })));
      setByMonth(dash.monthly.map(m => ({ name: m.month, income: Number(m.income), expense: Number(m.expense) })));
    }

    setAlerts(als ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const dismiss = async (id: number) => {
    const { error } = await api.alerts.markRead(id);
    if (error) toast.error(error.message);
    else load();
  };

  if (loading) return <Loader text="Loading your dashboard…" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Your financial snapshot at a glance</p>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.alert_id} className="glass rounded-xl p-4 flex items-center gap-3 border-warning/30">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.category_icon} {a.category_name}</div>
                <div className="text-xs text-muted-foreground">{a.message}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => dismiss(a.alert_id)}>Dismiss</Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`glass glass-hover rounded-2xl p-5 bg-gradient-to-br ${s.tint}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</span>
              <s.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="font-display text-2xl font-bold truncate">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Income vs Expenses (6 months)</h3>
          {byMonth.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" fill="hsl(158 84% 52%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="hsl(0 84% 62%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Spending by Category</h3>
          {byCat.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No expenses yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                  {byCat.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => fmtMoney(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
