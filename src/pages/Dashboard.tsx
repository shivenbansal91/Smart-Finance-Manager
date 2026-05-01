import { useEffect, useState } from "react";
import { api, DashboardData } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { fmtMoney } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle, ArrowUpDown,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import Loader from "@/components/Loader";
import { toast } from "sonner";

const COLORS = [
  "hsl(158 84% 52%)", "hsl(268 88% 64%)", "hsl(38 95% 60%)",
  "hsl(0 84% 62%)",   "hsl(220 90% 60%)", "hsl(180 80% 55%)", "hsl(320 80% 60%)",
];

// Recharts tooltip styled to match the dark glass theme
const ChartTooltipStyle = {
  background: "hsl(222 47% 11%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: "#e2e8f0",
  fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

interface Stat { label: string; value: string; icon: any; tint: string; sub?: string; negative?: boolean; }

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
      const netFlow = Number(dash.totalIncome) - Number(dash.totalExpense);
      const isNeg   = netFlow < 0;

      setStats([
        {
          label: "Total Savings",
          value: fmtMoney(dash.totalBalance),
          icon: Wallet,
          tint: "from-primary/20 to-primary/5",
          sub: "Sum of all account balances",
        },
        {
          label: "Total Income",
          value: fmtMoney(dash.totalIncome),
          icon: TrendingUp,
          tint: "from-emerald-500/20 to-emerald-500/5",
          sub: "All recorded income",
        },
        {
          label: "Total Expenses",
          value: fmtMoney(dash.totalExpense),
          icon: TrendingDown,
          tint: "from-red-500/20 to-red-500/5",
          sub: "All recorded expenses",
        },
        {
          label: "Net Cash Flow",
          value: fmtMoney(Math.abs(netFlow)),
          icon: isNeg ? TrendingDown : PiggyBank,
          tint: isNeg ? "from-red-500/20 to-red-500/5" : "from-emerald-500/20 to-emerald-500/5",
          sub: isNeg ? "Spending exceeds income" : "Earning more than spending",
          negative: isNeg,
        },
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

      {/* Budget alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.alert_id} className="glass rounded-xl p-4 flex items-center gap-3 border border-amber-500/30 bg-amber-500/5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`glass glass-hover rounded-2xl p-5 bg-gradient-to-br ${s.tint}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.negative ? "text-red-400" : "text-muted-foreground"}`} />
            </div>
            <div className={`font-display text-2xl font-bold truncate ${s.negative ? "text-red-400" : ""}`}>
              {s.negative ? "−" : ""}{s.value}
            </div>
            {s.sub && <div className="text-[10px] text-muted-foreground mt-1 truncate">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Bar chart */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Income vs Expenses (6 months)</h3>
          {byMonth.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byMonth} style={{ fontFamily: "inherit" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip contentStyle={ChartTooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="income"  fill="hsl(158 84% 52%)" radius={[6,6,0,0]} name="Income" />
                <Bar dataKey="expense" fill="hsl(0 84% 62%)"   radius={[6,6,0,0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Spending by Category</h3>
          {byCat.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No expenses yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105} paddingAngle={3}>
                  {byCat.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                </Pie>
                <Tooltip
                  contentStyle={ChartTooltipStyle}
                  formatter={(v: number) => [fmtMoney(v), "Spent"]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
