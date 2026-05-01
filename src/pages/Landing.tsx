import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet, TrendingUp, Shield, BarChart3, Bell, Database } from "lucide-react";

const features = [
  { icon: Wallet, title: "Multi-Account Tracking", desc: "Bank, cash, credit — all your money in one place." },
  { icon: BarChart3, title: "Smart Insights", desc: "Live charts of income, expenses & savings." },
  { icon: Bell, title: "Budget Alerts", desc: "Trigger-based warnings when you near a limit." },
  { icon: Database, title: "Normalized to 3NF", desc: "Built on a relational schema with full integrity." },
  { icon: TrendingUp, title: "Category Breakdown", desc: "See exactly where your money goes." },
  { icon: Shield, title: "Secure by Design", desc: "Row-level security — your data, only yours." },
];

export default function Landing() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      <header className="relative z-10 container flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">Smart Finance</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth?mode=signup"><Button variant="hero">Get started</Button></Link>
        </div>
      </header>

      <section className="relative z-10 container pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-muted-foreground mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          DBMS Mini Project · Thapar Institute
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] mb-6 animate-fade-in">
          Take control of your <br />
          <span className="gradient-text">personal finances</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
          A normalized, trigger-driven finance manager. Track accounts, log transactions,
          set budgets, and see live insights — backed by a real relational database.
        </p>
        <div className="flex items-center justify-center gap-4 animate-fade-in">
          <Link to="/auth?mode=signup">
            <Button variant="hero" size="lg" className="group">
              Start tracking <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link to="/auth"><Button variant="outline" size="lg">Sign in</Button></Link>
        </div>
      </section>

      <section className="relative z-10 container pb-32">
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="glass glass-hover rounded-2xl p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/40 py-8" />
    </div>
  );
}
