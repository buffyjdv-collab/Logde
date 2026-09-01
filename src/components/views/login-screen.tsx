"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Hotel,
  ShieldCheck,
  LogIn,
  Loader2,
  Eye,
  EyeOff,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

const DEMO_ACCOUNTS = [
  {
    role: "Super Admin",
    email: "superadmin@lodgehub.app",
    desc: "Platform-wide control",
    icon: ShieldCheck,
    color: "rose",
  },
  {
    role: "Lodge Owner",
    email: "owner@pinevalley.in",
    desc: "Full lodge access",
    icon: Building2,
    color: "emerald",
  },
  {
    role: "Receptionist",
    email: "reception@pinevalley.in",
    desc: "Bookings & front desk",
    icon: Hotel,
    color: "amber",
  },
];

export function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser);
  const setTenant = useAppStore((s) => s.setTenant);
  const setView = useAppStore((s) => s.setView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await authApi.login(email, password);
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as any,
        roleId: user.roleId || undefined,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin,
        permissions: user.permissions,
        menuItems: user.menuItems,
      });
      if (user.tenant) {
        setTenant(user.tenant.id, user.tenant.name);
      }
      toast.success(`Welcome back, ${user.name}!`);
      if (user.isSuperAdmin) {
        setView("platform_dashboard");
      } else {
        setView("dashboard");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("lodgehub123");
    setLoading(true);
    setError(null);
    try {
      const user = await authApi.login(demoEmail, "lodgehub123");
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as any,
        roleId: user.roleId || undefined,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin,
        permissions: user.permissions,
        menuItems: user.menuItems,
      });
      if (user.tenant) {
        setTenant(user.tenant.id, user.tenant.name);
      }
      toast.success(`Welcome back, ${user.name}!`);
      if (user.isSuperAdmin) {
        setView("platform_dashboard");
      } else {
        setView("dashboard");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left: branding / hero */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-12 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Hotel className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">LodgeHub</p>
            <p className="text-sm text-emerald-100">Lodge Management SaaS</p>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-3xl xl:text-4xl font-bold leading-tight">
            Run your lodge with confidence.
          </h1>
          <p className="text-emerald-50 text-lg leading-relaxed max-w-md">
            Bookings, rooms, guests, billing, housekeeping, RBAC, platform fees
            & deep revenue reports — all in one secure multi-tenant platform.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Multi-Tenant", "Molecular RBAC", "Platform Fees", "Audit Logs"].map(
              (tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-medium"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        </div>
        <div className="relative z-10 text-xs text-emerald-100/70">
          © {new Date().getFullYear()} LodgeHub. All rights reserved.
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">LodgeHub</p>
              <p className="text-xs text-muted-foreground">Lodge Management SaaS</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your credentials to access your dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Sign in
                </>
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
              Quick demo login (password: <code className="font-mono bg-muted px-1 py-0.5 rounded">lodgehub123</code>)
            </p>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                const colorMap: Record<string, string> = {
                  rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
                  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                  amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                };
                return (
                  <button
                    key={acc.email}
                    onClick={() => quickLogin(acc.email)}
                    disabled={loading}
                    className="flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm hover:border-primary/40 disabled:opacity-50"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border ${colorMap[acc.color]}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{acc.role}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {acc.email} · {acc.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
