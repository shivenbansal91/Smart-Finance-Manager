import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, Target,
  LogOut, Bell, WifiOff, Trash2,
  Lightbulb, Repeat, Landmark, Tag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const links = [
  { to: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { to: "/accounts",     label: "Accounts",     icon: Wallet },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/budgets",      label: "Budgets",      icon: Target },
  { to: "/insights",     label: "Insights",     icon: Lightbulb },
  { to: "/recurring",    label: "Recurring",    icon: Repeat },
  { to: "/loans",        label: "Loans",        icon: Landmark },
];

/** Gmail-style circular avatar button with dropdown */
function UserMenu() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = () => {
    setOpen(false);
    signOut();
    nav("/");
  };

  const handleDeleteAccount = async () => {
    setOpen(false);
    if (!confirm("⚠️ Permanently delete your account and ALL data? This cannot be undone.")) return;
    const { error } = await api.auth.deleteAccount();
    if (error) {
      toast.error("Delete failed: " + error.message);
    } else {
      toast.success("Account deleted.");
      signOut();
      nav("/");
    }
  };

  // Generate initials + gradient colour from name
  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        id="user-menu-btn"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-primary/50"
        title={user?.name ?? "Account"}
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-12 left-0 w-64 glass rounded-2xl shadow-2xl border border-border/60 overflow-hidden z-50 animate-fade-in">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{user?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5 space-y-0.5">
            <NavLink
              to="/categories"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Tag className="w-4 h-4 shrink-0" />
              Manage Categories
            </NavLink>
            <button
              id="signout-btn"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign out
            </button>
            <button
              id="delete-account-btn"
              onClick={handleDeleteAccount}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              Delete account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [apiDown, setApiDown]       = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      const { data } = await api.dashboard.health();
      setApiDown(!data?.ok);
    };

    const loadAlerts = async () => {
      const { data } = await api.alerts.count();
      setAlertCount(data?.count ?? 0);
    };

    checkHealth();
    loadAlerts();

    const interval = setInterval(() => {
      checkHealth();
      loadAlerts();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* API-down banner */}
      {apiDown && (
        <div className="sticky top-0 z-50 bg-destructive/10 border-b border-destructive/30 text-destructive px-5 py-2 flex items-center gap-2 text-sm">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            <strong>API unreachable.</strong> Make sure the backend is running:{" "}
            <code className="font-mono text-xs">cd server &amp;&amp; node server.js</code>
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl p-5 sticky top-0 h-screen">
          <div className="flex items-center gap-2 mb-10 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Smart Finance</span>
          </div>

          <nav className="flex-1 space-y-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  }`
                }
              >
                <Icon className="w-4 h-4" /> {label}
              </NavLink>
            ))}
          </nav>

          {/* User menu at bottom */}
          <div className="border-t border-border/60 pt-4 mt-4 flex items-center gap-3 px-1">
            <UserMenu />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">Signed in</div>
              <div className="text-sm font-medium truncate"
                   style={{ maxWidth: "160px" }}>
                {/* show name not email for cleaner look */}
                {user?.name}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {/* Mobile header */}
          <header className="md:hidden sticky top-0 z-20 glass border-b border-border/60 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold">Smart Finance</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-[10px] flex items-center justify-center text-destructive-foreground">
                    {alertCount}
                  </span>
                )}
              </div>
              <UserMenu />
            </div>
          </header>

          <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>

          {/* Mobile bottom nav — scrollable for 9 items */}
          <nav className="md:hidden sticky bottom-0 glass border-t border-border/60 flex overflow-x-auto gap-1 p-2 scrollbar-none">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2 px-3 rounded-lg text-[10px] shrink-0 whitespace-nowrap ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="w-4 h-4" /> {label}
              </NavLink>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}
