// MySQL REST API client — replaces Supabase client
// Usage: import { api } from "@/lib/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getToken(): string | null {
  return localStorage.getItem("sf_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${BASE}${path}`, { ...options, headers });
    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: json.error || "Request failed" } };
    }
    return { data: json as T, error: null };
  } catch (err: any) {
    // Catch "Failed to fetch" — means API server is not running
    if (err.message === "Failed to fetch" || err.name === "TypeError") {
      return {
        data: null,
        error: {
          message:
            "Cannot reach the API server. Make sure the backend is running:\n" +
            "  Open a terminal → cd server → node index.js",
        },
      };
    }
    return { data: null, error: { message: err.message || "Network error" } };
  }
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    async signUp(name: string, email: string, password: string) {
      return request<{ token: string; user: AppUser }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
    },
    async signIn(email: string, password: string) {
      return request<{ token: string; user: AppUser }>("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    async me() {
      return request<{ user: AppUser }>("/api/auth/me");
    },
    signOut() {
      localStorage.removeItem("sf_token");
      localStorage.removeItem("sf_user");
    },
    async deleteAccount() {
      return request<{ ok: boolean }>("/api/auth/account", { method: "DELETE" });
    },
    setSession(token: string, user: AppUser) {
      localStorage.setItem("sf_token", token);
      localStorage.setItem("sf_user", JSON.stringify(user));
    },
    getStoredUser(): AppUser | null {
      try {
        const u = localStorage.getItem("sf_user");
        return u ? JSON.parse(u) : null;
      } catch {
        return null;
      }
    },
  },

  // ── Accounts ────────────────────────────────────────────────────────────────
  accounts: {
    list: () => request<Account[]>("/api/accounts"),
    create: (body: { account_name: string; account_type: string; balance: number }) =>
      request<Account>("/api/accounts", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) =>
      request<{ ok: boolean }>(`/api/accounts/${id}`, { method: "DELETE" }),
    updateBalance: (id: number, balance: number) =>
      request<Account>(`/api/accounts/${id}/balance`, { method: "PATCH", body: JSON.stringify({ balance }) }),
  },

  // ── Categories ──────────────────────────────────────────────────────────────
  categories: {
    list: () => request<Category[]>("/api/categories"),
    create: (body: { name: string; type: string; icon: string }) =>
      request<Category>("/api/categories", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) =>
      request<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),
  },

  // ── Transactions ────────────────────────────────────────────────────────────
  transactions: {
    list: () => request<Transaction[]>("/api/transactions"),
    create: (body: {
      account_id: number;
      category_id: number;
      amount: number;
      txn_date: string;
      description?: string;
    }) => request<Transaction>("/api/transactions", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) =>
      request<{ ok: boolean }>(`/api/transactions/${id}`, { method: "DELETE" }),
  },

  // ── Budgets ─────────────────────────────────────────────────────────────────
  budgets: {
    list: () => request<Budget[]>("/api/budgets"),
    create: (body: {
      category_id: number;
      limit_amount: number;
      start_date: string;
      end_date: string;
    }) => request<Budget>("/api/budgets", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) =>
      request<{ ok: boolean }>(`/api/budgets/${id}`, { method: "DELETE" }),
  },

  // ── Budget Alerts ───────────────────────────────────────────────────────────
  alerts: {
    list: () => request<BudgetAlert[]>("/api/budget-alerts"),
    count: () => request<{ count: number }>("/api/budget-alerts/count"),
    markRead: (id: number) =>
      request<{ ok: boolean }>(`/api/budget-alerts/${id}/read`, { method: "PATCH" }),
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: {
    load:   () => request<DashboardData>("/api/dashboard"),
    health: () => request<{ ok: boolean; db: string }>("/api/health"),
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AppUser {
  userId: number;
  email: string;
  name: string;
}

export interface Account {
  account_id: number;
  user_id: number;
  account_name: string;
  account_type: "bank" | "cash" | "credit" | "savings";
  balance: number;
  created_at: string;
}

export interface Category {
  category_id: number;
  user_id: number;
  name: string;
  type: "income" | "expense";
  icon: string | null;
}

export interface Transaction {
  transaction_id: number;
  user_id: number;
  account_id: number;
  category_id: number;
  amount: number;
  txn_date: string;
  description: string | null;
  created_at: string;
  account_name: string;
  category_name: string;
  category_type: "income" | "expense";
  category_icon: string | null;
}

export interface Budget {
  budget_id: number;
  user_id: number;
  category_id: number;
  limit_amount: number;
  start_date: string;
  end_date: string;
  category_name: string;
  category_icon: string | null;
  spent: number;
}

export interface BudgetAlert {
  alert_id: number;
  user_id: number;
  budget_id: number;
  message: string;
  spent: number;
  limit_amount: number;
  created_at: string;
  is_read: number;
  category_name: string;
  category_icon: string | null;
}

export interface DashboardData {
  monthly: { month: string; month_key: string; income: number; expense: number }[];
  catSpend: { name: string; type: string; total: number }[];
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
}
