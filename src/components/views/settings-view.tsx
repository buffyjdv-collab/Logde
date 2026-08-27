"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Building2,
  CreditCard,
  Palette,
  Bell,
  Database,
  Trash2,
  Sun,
  Moon,
  Save,
  CheckCircle2,
  ShieldCheck,
  CalendarDays,
  AlertTriangle,
  Loader2,
  LogIn,
  LogOut,
  Wallet,
  Sparkles,
  CalendarCheck,
  Crown,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/constants";
import { toast } from "sonner";

// ── Static plan data (mirrors prisma/seed.ts) ──────────────────────
interface PlanInfo {
  id: string;
  name: string;
  price: number;
  maxRooms: number;
  maxUsers: number;
  features: string[];
  popular?: boolean;
  accent: "emerald" | "sky" | "violet" | "amber";
}

const PLANS: PlanInfo[] = [
  {
    id: "starter",
    name: "Starter",
    price: 999,
    maxRooms: 10,
    maxUsers: 3,
    accent: "sky",
    features: ["Dashboard", "Bookings", "Rooms", "Guests", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 2499,
    maxRooms: 30,
    maxUsers: 8,
    popular: true,
    accent: "emerald",
    features: [
      "Everything in Starter",
      "Housekeeping",
      "Expenses",
      "Reports",
      "Invoicing",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    price: 4999,
    maxRooms: 80,
    maxUsers: 20,
    accent: "violet",
    features: [
      "Everything in Growth",
      "Multi-property",
      "Advanced Reports",
      "Audit Logs",
      "API access",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 9999,
    maxRooms: 200,
    maxUsers: 50,
    accent: "amber",
    features: [
      "Everything in Scale",
      "Custom integrations",
      "Dedicated manager",
      "SLA guarantee",
      "On-premise option",
    ],
  },
];

const PLAN_ACCENT_CLASSES: Record<
  PlanInfo["accent"],
  { ring: string; text: string; bg: string; border: string }
> = {
  emerald: {
    ring: "ring-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
  },
  sky: {
    ring: "ring-sky-500",
    text: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/40",
  },
  violet: {
    ring: "ring-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/40",
  },
  amber: {
    ring: "ring-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
  },
};

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "America/New_York",
  "Europe/London",
  "Australia/Sydney",
];

const NOTIFICATION_TYPES = [
  {
    key: "check_in",
    label: "Check-in alerts",
    description: "When a guest checks in",
    icon: LogIn,
    color: "text-emerald-600",
  },
  {
    key: "check_out",
    label: "Check-out alerts",
    description: "When a guest checks out",
    icon: LogOut,
    color: "text-amber-600",
  },
  {
    key: "payment",
    label: "Payment receipts",
    description: "When a payment is recorded",
    icon: Wallet,
    color: "text-sky-600",
  },
  {
    key: "maintenance",
    label: "Maintenance requests",
    description: "When a room needs repair",
    icon: Sparkles,
    color: "text-violet-600",
  },
  {
    key: "booking",
    label: "New bookings",
    description: "When a new booking is created",
    icon: CalendarCheck,
    color: "text-rose-600",
  },
] as const;

export function SettingsView() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const tenantName = useAppStore((s) => s.tenantName);
  const tenantId = useAppStore((s) => s.tenantId);

  const queryClient = useQueryClient();

  // Avoid hydration mismatch for theme switch.
  // Defer the mounted flag with requestAnimationFrame so setState
  // is not called synchronously inside the effect body (avoids the
  // cascading-render React Hooks lint rule).
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Lodge profile form state
  const [profile, setProfile] = useState({
    name: tenantName || "Pine Valley Lodge",
    contactEmail: "admin@pinevalley.in",
    contactPhone: "91 1234567890",
    address: "Forest Road, Manali, Himachal Pradesh 175131",
    currency: "INR",
    timezone: "Asia/Kolkata",
  });

  // Notification toggle state
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    check_in: true,
    check_out: true,
    payment: true,
    maintenance: false,
    booking: true,
  });

  // Upgrade plan dialog
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("growth");

  // Active plan (could be tied to tenant in future; for demo = Growth)
  const currentPlanId = "growth";
  const currentPlan = PLANS.find((p) => p.id === currentPlanId)!;

  // ── Mutations / actions ───────────────────────────────────────────
  const saveProfile = () => {
    toast.success("Settings saved", {
      description: "Lodge profile updated locally.",
    });
  };

  const toggleNotification = (key: string) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const confirmUpgrade = () => {
    const plan = PLANS.find((p) => p.id === selectedPlan);
    toast.success(`Switched to ${plan?.name}`, {
      description: `Plan change confirmed (${formatCurrency(plan?.price || 0)}/mo). This is a demo — no payment was processed.`,
    });
    setUpgradeOpen(false);
  };

  const reseedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Re-seed failed" }));
        throw new Error(err.error || "Re-seed failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Database re-seeded", {
        description: "Refresh to see fresh demo data.",
      });
      // Invalidate all queries so any open views refetch
      queryClient.invalidateQueries();
    },
    onError: (e: Error) =>
      toast.error("Re-seed failed", { description: e.message }),
  });

  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your lodge profile, subscription, appearance, and system preferences."
        icon={<SettingsIcon className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Lodge Profile ───────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <Building2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle>Lodge Profile</CardTitle>
                <CardDescription>
                  Basic information about your lodge shown across the app.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lodge-name">Lodge Name</Label>
              <Input
                id="lodge-name"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lodge-email">Contact Email</Label>
              <Input
                id="lodge-email"
                type="email"
                value={profile.contactEmail}
                onChange={(e) =>
                  setProfile({ ...profile, contactEmail: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lodge-phone">Contact Phone</Label>
              <Input
                id="lodge-phone"
                value={profile.contactPhone}
                onChange={(e) =>
                  setProfile({ ...profile, contactPhone: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lodge-address">Address</Label>
              <Input
                id="lodge-address"
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={profile.currency}
                onValueChange={(v) =>
                  setProfile({ ...profile, currency: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select
                value={profile.timezone}
                onValueChange={(v) =>
                  setProfile({ ...profile, timezone: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 justify-end">
            <Button onClick={saveProfile} className="gap-1.5">
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </CardFooter>
        </Card>

        {/* ── Subscription ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-500/10 p-2.5">
                  <CreditCard className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>
                    Your current plan and billing details.
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 bg-emerald-500/5">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Current Plan</p>
                  <p className="text-xl font-bold flex items-center gap-2">
                    {currentPlan.name}
                    {currentPlan.popular && (
                      <Crown className="h-4 w-4 text-amber-500" />
                    )}
                  </p>
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(currentPlan.price)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Max Rooms</p>
                  <p className="font-semibold">{currentPlan.maxRooms}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Users</p>
                  <p className="font-semibold">{currentPlan.maxUsers}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Included Features</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {currentPlan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
              <CalendarDays className="h-4 w-4" />
              <span>
                Renews on{" "}
                <span className="font-medium text-foreground">
                  {formatDate(
                    new Date(
                      new Date().setMonth(new Date().getMonth() + 1)
                    )
                  )}
                </span>
              </span>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 justify-end">
            <Button
              variant="outline"
              onClick={() => setUpgradeOpen(true)}
              className="gap-1.5"
            >
              <CreditCard className="h-4 w-4" /> Upgrade Plan
            </Button>
          </CardFooter>
        </Card>

        {/* ── Appearance ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <Palette className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how LodgeHub looks on this device.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:bg-muted/40",
                  !isDark
                    ? "border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/30"
                    : "border-input"
                )}
              >
                <div className="rounded-full bg-amber-100 p-2.5">
                  <Sun className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium">Light</span>
                {!isDark && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:bg-muted/40",
                  isDark
                    ? "border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/30"
                    : "border-input"
                )}
              >
                <div className="rounded-full bg-zinc-800 p-2.5">
                  <Moon className="h-5 w-5 text-zinc-100" />
                </div>
                <span className="text-sm font-medium">Dark</span>
                {isDark && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Current theme:{" "}
              <span className="font-medium text-foreground">
                {mounted ? theme || "system" : "loading…"}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* ── Notifications ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-500/10 p-2.5">
                <Bell className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Choose which events trigger in-app notifications.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {NOTIFICATION_TYPES.map((n, idx) => {
              const Icon = n.icon;
              const enabled = notifications[n.key];
              return (
                <div key={n.key}>
                  {idx > 0 && <Separator className="my-1" />}
                  <div className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("rounded-lg bg-muted p-1.5", n.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {n.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {n.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleNotification(n.key)}
                      aria-label={`Toggle ${n.label}`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Multi-Tenant Info ───────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-500/10 p-2.5">
                <ShieldCheck className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <CardTitle>Multi-Tenant Info</CardTitle>
                <CardDescription>
                  This tenant's identity in the multi-tenant LodgeHub cluster.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Tenant ID" value={tenantId} mono />
            <Separator />
            <InfoRow label="Status" value="Active" badge="emerald" />
            <Separator />
            <InfoRow label="Plan" value={currentPlan.name} badge="violet" />
            <Separator />
            <InfoRow
              label="Created"
              value={formatDate(new Date("2024-04-01"))}
            />
            <Separator />
            <InfoRow
              label="Region"
              value="ap-south-1 (Mumbai)"
            />
          </CardContent>
        </Card>

        {/* ── Danger Zone ─────────────────────────────────────────── */}
        <Card className="border-rose-500/40 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-500/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <CardTitle className="text-rose-700 dark:text-rose-400">
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible and destructive actions. Proceed with caution.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Re-seed Database</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                    Wipes all current data for this tenant and re-inserts the
                    fresh Pine Valley demo dataset. Useful for demos &amp;
                    training. <strong>Cannot be undone.</strong>
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="gap-1.5 shrink-0"
                    disabled={reseedMutation.isPending}
                  >
                    {reseedMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Re-seed Database
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Re-seed the entire database?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all bookings, payments,
                      guests, rooms, and audit logs for{" "}
                      <span className="font-medium text-foreground">
                        {tenantId}
                      </span>{" "}
                      and replace them with the fresh demo dataset. This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => reseedMutation.mutate()}
                      className="bg-rose-600 hover:bg-rose-700 gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Yes, re-seed now
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Upgrade Plan Dialog ────────────────────────────────────── */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-violet-600" />
              Choose a plan
            </DialogTitle>
            <DialogDescription>
              Pick the plan that fits your lodge. Switch any time — prorated
              automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {PLANS.map((plan) => {
              const accent = PLAN_ACCENT_CLASSES[plan.accent];
              const isSelected = selectedPlan === plan.id;
              const isCurrent = plan.id === currentPlanId;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    "relative text-left rounded-xl border p-4 transition-all hover:shadow-md",
                    isSelected
                      ? cn(accent.border, "ring-2", accent.ring, "bg-muted/40")
                      : "border-input"
                  )}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2.5 right-3 bg-emerald-500 text-white border-0 text-[10px]">
                      POPULAR
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge className="absolute -top-2.5 left-3 bg-sky-500 text-white border-0 text-[10px]">
                      CURRENT
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <h4 className={cn("text-base font-semibold", accent.text)}>
                      {plan.name}
                    </h4>
                    {isSelected && (
                      <CheckCircle2
                        className={cn("h-5 w-5", accent.text)}
                      />
                    )}
                  </div>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {formatCurrency(plan.price)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /mo
                    </span>
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{plan.maxRooms} rooms</span>
                    <span>·</span>
                    <span>{plan.maxUsers} users</span>
                  </div>
                  <Separator className="my-3" />
                  <ul className="space-y-1.5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-1.5 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmUpgrade}
              disabled={selectedPlan === currentPlanId}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm {PLANS.find((p) => p.id === selectedPlan)?.name} Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper component for read-only info rows ──────────────────────
function InfoRow({
  label,
  value,
  mono = false,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: "emerald" | "violet" | "sky" | "amber";
}) {
  const badgeClasses: Record<string, string> = {
    emerald:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    violet:
      "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
    sky: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    amber:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant="outline" className={cn("font-medium", badgeClasses[badge])}>
          {value}
        </Badge>
      ) : (
        <span className={cn("text-sm font-medium", mono && "font-mono text-xs")}>
          {value}
        </span>
      )}
    </div>
  );
}
