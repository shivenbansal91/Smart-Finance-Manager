import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Info, AlertTriangle, Sparkles,
  BarChart2, Calendar, PiggyBank, Zap, RefreshCw, Lightbulb, Landmark,
} from "lucide-react";
import { api, Insight } from "@/lib/api";
import { toast } from "sonner";

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  "trending-up":    TrendingUp,
  "trending-down":  TrendingDown,
  "bar-chart":      BarChart2,
  "calendar":       Calendar,
  "piggy-bank":     PiggyBank,
  "alert-triangle": AlertTriangle,
  "zap":            Zap,
  "info":           Info,
  "sparkles":       Sparkles,
  "landmark":       Landmark,
};

// ── Colour map per type ───────────────────────────────────────────────────────
const TYPE_STYLE: Record<string, { card: string; icon: string; badge: string }> = {
  success: {
    card: "border-emerald-500/30 bg-emerald-500/5",
    icon: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
  warning: {
    card: "border-amber-500/30 bg-amber-500/5",
    icon: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300",
  },
  danger: {
    card: "border-red-500/30 bg-red-500/5",
    icon: "text-red-400",
    badge: "bg-red-500/15 text-red-300",
  },
  ai: {
    card: "border-violet-500/30 bg-violet-500/5",
    icon: "text-violet-400",
    badge: "bg-violet-500/15 text-violet-300",
  },
  info: {
    card: "border-sky-500/30 bg-sky-500/5",
    icon: "text-sky-400",
    badge: "bg-sky-500/15 text-sky-300",
  },
  loan: {
    card: "border-amber-600/30 bg-amber-600/5",
    icon: "text-amber-500",
    badge: "bg-amber-500/15 text-amber-300",
  },
};

const LABEL: Record<string, string> = {
  success: "Saving Well",
  warning: "Heads Up",
  danger:  "Action Needed",
  ai:      "AI Tip",
  info:    "Insight",
  loan:    "Loan Advisor",
};

// ── InsightCard ───────────────────────────────────────────────────────────────
function InsightCard({ item }: { item: Insight }) {
  const s   = TYPE_STYLE[item.type] ?? TYPE_STYLE.info;
  const Ico = ICON_MAP[item.icon] ?? Info;

  return (
    <div className={`rounded-2xl border p-5 transition-all hover:scale-[1.01] ${s.card}`}>
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 p-2.5 rounded-xl bg-background/50 shrink-0 ${s.icon}`}>
          <Ico className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
              {LABEL[item.type] ?? "Insight"}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
          {item.suggestion && (
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-background/40 rounded-lg px-3 py-2 border border-border/30">
              <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
              {item.suggestion}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [hasGemini, setHasGemini] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await api.insights.load();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data) {
      setInsights(data.insights);
      setHasGemini(data.hasGemini);
      setGenerated(data.generated);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = { success: 0, warning: 0, danger: 0, ai: 0, info: 0 };
  insights.forEach(i => { counts[i.type as keyof typeof counts] = (counts[i.type as keyof typeof counts] || 0) + 1; });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">AI Spending Insights</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Rule-based analysis of your last 3 months of transactions
            {hasGemini && <span className="ml-2 text-violet-400 font-medium">✦ Gemini enhanced</span>}
          </p>
        </div>
        <button
          id="refresh-insights-btn"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analysing…" : "Refresh"}
        </button>
      </div>

      {/* Summary pills */}
      {!loading && insights.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {counts.danger  > 0 && <div className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-300">{counts.danger} Action Needed</div>}
          {counts.warning > 0 && <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300">{counts.warning} Heads Up</div>}
          {counts.success > 0 && <div className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300">{counts.success} Good News</div>}
          {counts.ai      > 0 && <div className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300">{counts.ai} AI Tips</div>}
          {(counts as any).loan > 0 && <div className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-600/15 text-amber-300">{(counts as any).loan} Loan Advice</div>}
          {counts.info    > 0 && <div className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300">{counts.info} Info</div>}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {/* Cards */}
      {!loading && (
        <div className="space-y-4">
          {insights.map((item, i) => (
            <InsightCard key={i} item={item} />
          ))}
        </div>
      )}

      {/* Footer timestamp */}
      {generated && !loading && (
        <p className="text-xs text-muted-foreground text-right">
          Generated at {new Date(generated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
