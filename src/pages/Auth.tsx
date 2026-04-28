import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin"
  );
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]       = useState(false);
  const [fieldError, setFieldError] = useState("");

  // ── Client-side validation ──────────────────────────────────────────────────
  function validate(): boolean {
    setFieldError("");
    if (mode === "signup" && !name.trim()) {
      setFieldError("Name is required");
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError("Enter a valid email address");
      return false;
    }
    if (password.length < 6) {
      setFieldError("Password must be at least 6 characters");
      return false;
    }
    return true;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await api.auth.signUp(name.trim(), email.trim(), password);
        if (error) throw new Error(error.message);
        if (data) {
          api.auth.setSession(data.token, data.user);
          setUser(data.user);
          toast.success("Account created! Welcome aboard.");
          nav("/dashboard");
        }
      } else {
        const { data, error } = await api.auth.signIn(email.trim(), password);
        if (error) throw new Error(error.message);
        if (data) {
          api.auth.setSession(data.token, data.user);
          setUser(data.user);
          nav("/dashboard");
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signup" ? "signin" : "signup");
    setFieldError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="relative w-full max-w-md glass rounded-3xl p-8 animate-fade-in">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">Smart Finance</span>
        </Link>

        <h1 className="font-display text-3xl font-bold text-center mb-2">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-center text-muted-foreground mb-8 text-sm">
          {mode === "signup" ? "Start managing your money in seconds" : "Sign in to your dashboard"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => { setName(e.target.value); setFieldError(""); }}
                placeholder="Aryan Sharma"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldError(""); }}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldError(""); }}
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {/* Inline validation error */}
          {fieldError && (
            <p className="text-sm text-destructive">{fieldError}</p>
          )}

          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={switchMode} className="text-primary hover:underline font-medium">
            {mode === "signup" ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
