"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  Ban,
  Search,
  UserPlus,
  Pencil,
  CalendarPlus,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  StickyNote,
  Hash,
  IndianRupee,
} from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { guestsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  ID_TYPES,
  BOOKING_STATUS,
  PAYMENT_METHOD,
  PAYMENT_TYPE,
  formatCurrency,
  formatDate,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Guest, Booking, Payment } from "@/lib/types";

// Helpers ─────────────────────────────────────────────────────────────────

function cityFromAddress(address: string | null): string {
  if (!address) return "—";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  // Heuristic: city is usually the second-to-last segment.
  return parts[parts.length - 2] || parts[0];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Empty form shape ────────────────────────────────────────────────────────

interface GuestFormState {
  name: string;
  mobile: string;
  email: string;
  address: string;
  idType: string;
  idNumber: string;
  company: string;
  gstNumber: string;
  notes: string;
  blacklisted: boolean;
}

const EMPTY_FORM: GuestFormState = {
  name: "",
  mobile: "",
  email: "",
  address: "",
  idType: "aadhaar",
  idNumber: "",
  company: "",
  gstNumber: "",
  notes: "",
  blacklisted: false,
};

// Main view ───────────────────────────────────────────────────────────────

export function GuestsView() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [form, setForm] = useState<GuestFormState>(EMPTY_FORM);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: guests = [], isLoading } = useQuery({
    queryKey: ["guests", debouncedSearch],
    queryFn: () => guestsApi.list(debouncedSearch),
  });

  const stats = useMemo(() => {
    const total = guests.length;
    const returning = guests.filter((g) => (g.bookingsCount ?? 0) > 1).length;
    const blacklisted = guests.filter((g) => g.blacklisted).length;
    return { total, returning, blacklisted };
  }, [guests]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormMode("add");
    setEditingGuestId(null);
    setFormOpen(true);
  };

  const openEdit = (g: Guest) => {
    setForm({
      name: g.name,
      mobile: g.mobile,
      email: g.email ?? "",
      address: g.address ?? "",
      idType: g.idType ?? "aadhaar",
      idNumber: g.idNumber ?? "",
      company: g.company ?? "",
      gstNumber: g.gstNumber ?? "",
      notes: g.notes ?? "",
      blacklisted: g.blacklisted,
    });
    setFormMode("edit");
    setEditingGuestId(g.id);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Guests"
        description="Manage guest profiles, history, and contact details."
        icon={<Users className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Guest</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="Total Guests"
          value={stats.total}
          icon={Users}
          accent="emerald"
          hint="Registered profiles"
        />
        <StatCard
          label="Returning Guests"
          value={stats.returning}
          icon={UserCheck}
          accent="sky"
          hint="More than 1 stay"
        />
        <StatCard
          label="Blacklisted"
          value={stats.blacklisted}
          icon={Ban}
          accent={stats.blacklisted > 0 ? "rose" : "zinc"}
          hint="Flagged profiles"
        />
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">City</TableHead>
                <TableHead className="text-center">Stays</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="hidden md:table-cell">Last Stay</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <LoadingTable rows={6} />
                  </TableCell>
                </TableRow>
              ) : guests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={Users}
                      title={
                        debouncedSearch
                          ? "No guests match your search"
                          : "No guests yet"
                      }
                      description={
                        debouncedSearch
                          ? "Try a different name, mobile, or email."
                          : "Add your first guest to start booking rooms."
                      }
                      action={
                        !debouncedSearch ? (
                          <Button size="sm" onClick={openAdd} className="gap-1.5">
                            <UserPlus className="h-4 w-4" /> Add Guest
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                guests.map((g) => (
                  <TableRow
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              g.blacklisted
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-emerald-500/10 text-emerald-600"
                            )}
                          >
                            {initials(g.name) || g.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground truncate md:hidden">
                            {g.mobile}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        <p className="font-medium">{g.mobile}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {g.email || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {cityFromAddress(g.address)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {g.bookingsCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(g.totalSpent ?? 0)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {g.lastStay ? formatDate(g.lastStay) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {g.blacklisted ? (
                        <Badge
                          variant="outline"
                          className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 gap-1.5"
                        >
                          <Ban className="h-3 w-3" />
                          Blacklisted
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        >
                          Active
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Detail sheet */}
      <GuestDetailSheet
        guestId={selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
        onEdit={(g) => {
          setSelectedId(null);
          openEdit(g);
        }}
      />

      {/* Add / Edit form */}
      <GuestFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        editingGuestId={editingGuestId}
        form={form}
        setForm={setForm}
      />
    </div>
  );
}

// ── Detail sheet ─────────────────────────────────────────────────────────

function GuestDetailSheet({
  guestId,
  onOpenChange,
  onEdit,
}: {
  guestId: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (g: Guest) => void;
}) {
  const setQuickAction = useAppStore((s) => s.setQuickAction);

  const { data, isLoading } = useQuery({
    queryKey: ["guest", guestId],
    queryFn: () => (guestId ? guestsApi.get(guestId) : Promise.reject()),
    enabled: !!guestId,
  });

  const guest: Guest | undefined = data;
  const bookings: Booking[] = data?.bookings ?? [];
  const payments: Payment[] = data?.payments ?? [];

  return (
    <Sheet
      open={!!guestId}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
    >
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto scrollbar-thin p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            {guest && (
              <Avatar className="h-10 w-10">
                <AvatarFallback
                  className={cn(
                    "text-sm font-semibold",
                    guest.blacklisted
                      ? "bg-rose-500/10 text-rose-600"
                      : "bg-emerald-500/10 text-emerald-600"
                  )}
                >
                  {initials(guest.name) || guest.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <p className="truncate">{guest?.name ?? "Guest"}</p>
              <p className="text-xs text-muted-foreground font-normal">
                {guest ? `Guest since ${formatDate(guest.createdAt)}` : "Loading…"}
              </p>
            </div>
          </SheetTitle>
        </SheetHeader>

        {isLoading || !guest ? (
          <div className="p-6">
            <LoadingTable rows={3} />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Action row */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => setQuickAction("new_booking")}
                className="gap-1.5"
              >
                <CalendarPlus className="h-4 w-4" />
                New Booking
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(guest)}
                className="gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {guest.blacklisted ? (
                <Badge
                  variant="outline"
                  className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 ml-auto"
                >
                  <Ban className="h-3 w-3 mr-1" /> Blacklisted
                </Badge>
              ) : null}
            </div>

            {/* Contact & ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailRow icon={Phone} label="Mobile" value={guest.mobile} />
              <DetailRow
                icon={Mail}
                label="Email"
                value={guest.email || "—"}
              />
              <DetailRow
                icon={MapPin}
                label="Address"
                value={guest.address || "—"}
                full
              />
              <DetailRow
                icon={FileText}
                label="ID Type"
                value={
                  guest.idType
                    ? ID_TYPES[guest.idType as keyof typeof ID_TYPES] ?? guest.idType
                    : "—"
                }
              />
              <DetailRow
                icon={Hash}
                label="ID Number"
                value={guest.idNumber || "—"}
              />
              <DetailRow
                icon={Building2}
                label="Company"
                value={guest.company || "—"}
              />
              <DetailRow
                icon={FileText}
                label="GST Number"
                value={guest.gstNumber || "—"}
              />
            </div>

            {guest.notes && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <StickyNote className="h-3.5 w-3.5" /> Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">{guest.notes}</p>
              </div>
            )}

            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Stays</p>
                <p className="text-lg font-bold tabular-nums">
                  {guest.bookingsCount ?? bookings.length}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600">
                  {formatCurrency(
                    guest.totalSpent ??
                      bookings.reduce((s, b) => s + b.totalAmount, 0)
                  )}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Last Stay</p>
                <p className="text-sm font-semibold mt-1">
                  {guest.lastStay ? formatDate(guest.lastStay) : "—"}
                </p>
              </div>
            </div>

            {/* Booking history */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-muted-foreground" />
                Booking History
                <Badge variant="secondary" className="ml-1">
                  {bookings.length}
                </Badge>
              </h3>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center rounded-lg border bg-muted/20">
                  No bookings yet
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 rounded-lg border p-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            {b.bookingCode}
                          </span>
                          <span className="text-sm font-medium">
                            Room {b.room.number}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <StatusBadge status={b.status} map={BOOKING_STATUS} />
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(b.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Payment history */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                Payment History
                <Badge variant="secondary" className="ml-1">
                  {payments.length}
                </Badge>
              </h3>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center rounded-lg border bg-muted/20">
                  No payments recorded
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border p-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {PAYMENT_TYPE[p.type as keyof typeof PAYMENT_TYPE] ?? p.type}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(p.createdAt, "dd MMM yyyy, hh:mm a")}
                          {p.reference ? ` · Ref ${p.reference}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <StatusBadge
                          status={p.method}
                          map={PAYMENT_METHOD}
                          withDot={false}
                        />
                        <span className="text-sm font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  full,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        full && "sm:col-span-2"
      )}
    >
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  );
}

// ── Add / Edit form dialog ───────────────────────────────────────────────

function GuestFormDialog({
  open,
  onOpenChange,
  mode,
  editingGuestId,
  form,
  setForm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  editingGuestId: string | null;
  form: GuestFormState;
  setForm: (f: GuestFormState) => void;
}) {
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: () =>
      guestsApi.create({
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        address: form.address || undefined,
        idType: form.idType,
        idNumber: form.idNumber || undefined,
        company: form.company || undefined,
        gstNumber: form.gstNumber || undefined,
        notes: form.notes || undefined,
        blacklisted: form.blacklisted,
      }),
    onSuccess: (g) => {
      toast.success(`Guest ${g.name} created`);
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) =>
      guestsApi.update(id, {
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        address: form.address || undefined,
        idType: form.idType,
        idNumber: form.idNumber || undefined,
        company: form.company || undefined,
        gstNumber: form.gstNumber || undefined,
        notes: form.notes || undefined,
        blacklisted: form.blacklisted,
      }),
    onSuccess: (g) => {
      toast.success(`Guest ${g.name} updated`);
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      if (editingGuestId) {
        queryClient.invalidateQueries({ queryKey: ["guest", editingGuestId] });
      }
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = form.name.trim() !== "" && form.mobile.trim() !== "";
  const canSubmit =
    valid &&
    !createMut.isPending &&
    !updateMut.isPending &&
    (mode === "add" || !!editingGuestId);

  const submit = () => {
    if (!valid) return;
    if (mode === "edit") {
      if (!editingGuestId) {
        toast.error("Could not resolve guest id for update");
        return;
      }
      updateMut.mutate(editingGuestId);
    } else {
      createMut.mutate();
    }
  };

  const set = <K extends keyof GuestFormState>(k: K, v: GuestFormState[K]) =>
    setForm({ ...form, [k]: v });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setForm(EMPTY_FORM);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "add" ? (
              <>
                <UserPlus className="h-5 w-5 text-emerald-600" />
                Add Guest
              </>
            ) : (
              <>
                <Pencil className="h-5 w-5 text-emerald-600" />
                Edit Guest
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Full Name *" hint="Guest name as on ID">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Aditya Khanna"
              />
            </Field>
            <Field label="Mobile *" hint="10-digit contact">
              <Input
                value={form.mobile}
                onChange={(e) => set("mobile", e.target.value)}
                placeholder="9876543210"
                maxLength={15}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="guest@email.com"
              />
            </Field>
            <Field label="Company / Org">
              <Input
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Address" full>
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="House, Street, City, State"
              />
            </Field>
            <Field label="ID Type">
              <Select
                value={form.idType}
                onValueChange={(v) => set("idType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ID_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ID Number">
              <Input
                value={form.idNumber}
                onChange={(e) => set("idNumber", e.target.value)}
                placeholder="e.g. XXXX XXXX XXXX"
              />
            </Field>
            <Field label="GST Number" full>
              <Input
                value={form.gstNumber}
                onChange={(e) => set("gstNumber", e.target.value)}
                placeholder="Optional GSTIN for business guests"
              />
            </Field>
            <Field label="Notes" full>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Preferences, allergies, VIP, etc."
                rows={3}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg border p-3 hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={form.blacklisted}
              onChange={(e) => set("blacklisted", e.target.checked)}
              className="h-4 w-4 rounded border-input accent-rose-600"
            />
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-rose-600" />
                Blacklist this guest
              </p>
              <p className="text-xs text-muted-foreground">
                Flagged guests will be blocked from new bookings.
              </p>
            </div>
          </label>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="gap-1.5"
          >
            {mode === "add"
              ? createMut.isPending
                ? "Creating…"
                : "Create Guest"
              : updateMut.isPending
              ? "Saving…"
              : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <Label className="text-xs">
        {label}
        {hint && (
          <span className="ml-1 text-muted-foreground font-normal">· {hint}</span>
        )}
      </Label>
      {children}
    </div>
  );
}
