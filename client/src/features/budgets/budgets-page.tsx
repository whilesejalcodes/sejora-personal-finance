import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryInput } from "@/components/forms/category-input";
import { createBudget, deleteBudget, getBudgets, updateBudget } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import { budgetCreateSchema, type BudgetCreateInput, type BudgetUpdateInput } from "../../../../shared/schemas/index.js";
import type { BudgetStatus, BudgetView } from "../../../../shared/types/index.js";

type FormValues = {
  name: string;
  category: string;
  amount: string;
  month: string;
};

const todayMonth = () => new Date().toISOString().slice(0, 7);

function blankForm(): FormValues {
  return { name: "", category: "", amount: "", month: todayMonth() };
}

function monthRange(month: string): { startDate: string; endDate: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function amountToMinorUnits(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter an amount with up to two decimal places.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Enter an amount greater than zero.");
  }
  return amountMinor;
}

function formFromBudget(budget: BudgetView): FormValues {
  return {
    name: budget.name,
    category: budget.category ?? "",
    amount: (budget.amountMinor / 100).toFixed(2).replace(/\.00$/, ""),
    month: budget.startDate.slice(0, 7),
  };
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

const statusContent: Record<BudgetStatus, { label: string; className: string; barClassName: string }> = {
  healthy: { label: "Healthy", className: "bg-positive/10 text-positive", barClassName: "bg-positive" },
  approaching: { label: "Approaching limit", className: "bg-amber-50 text-amber-700", barClassName: "bg-amber-500" },
  at_limit: { label: "At limit", className: "bg-orange-50 text-orange-700", barClassName: "bg-orange-500" },
  overspent: { label: "Overspent", className: "bg-rose-50 text-rose-700", barClassName: "bg-rose-600" },
};

export function BudgetsPage() {
  const [month, setMonth] = useState(todayMonth);
  const [budgets, setBudgets] = useState<BudgetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetView | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBudgets({ month });
      setBudgets(result.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Budgets could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadBudgets();
  }, [loadBudgets]);

  const totals = useMemo(() => budgets.reduce(
    (result, budget) => ({
      planned: result.planned + budget.amountMinor,
      spent: result.spent + budget.spentMinor,
      remaining: result.remaining + budget.remainingMinor,
    }),
    { planned: 0, spent: 0, remaining: 0 },
  ), [budgets]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(budget: BudgetView) {
    setEditing(budget);
    setConfirmingId(null);
    setFormOpen(true);
  }

  async function handleDelete(budgetId: string) {
    setDeletingId(budgetId);
    try {
      await deleteBudget(budgetId);
      setBudgets((current) => current.filter((budget) => budget.id !== budgetId));
      setConfirmingId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The budget could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Plan with clarity"
        title="Budgets"
        description="Set a monthly boundary, then let your transaction history show how much room remains."
        action={<Button onClick={openCreate}><Plus size={17} /> Add budget</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Review period</p>
          <div className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-800">
            <CalendarDays size={18} className="text-primary" />
            <span>{formatMonth(month)}</span>
          </div>
        </div>
        <label className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Month</span>
          <input aria-label="Budget review month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="form-input w-auto" />
        </label>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Planned" value={formatCurrency(totals.planned / 100)} />
        <SummaryCard label="Spent" value={formatCurrency(totals.spent / 100)} tone="negative" />
        <SummaryCard label="Room remaining" value={formatCurrency(totals.remaining / 100)} tone={totals.remaining < 0 ? "negative" : "positive"} />
      </div>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">Budgets are unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{error}</p>
            </div>
            <Button variant="secondary" onClick={() => void loadBudgets()}><RefreshCw size={15} /> Try again</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : budgets.length === 0 ? (
        <EmptyState
          title="No spending plans yet"
          description="Set a boundary for a category or the month, then see how much room remains."
          detail
          action={<Button onClick={openCreate}><Plus size={16} /> Add budget</Button>}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              confirming={confirmingId === budget.id}
              deleting={deletingId === budget.id}
              onEdit={() => openEdit(budget)}
              onConfirm={() => setConfirmingId(budget.id)}
              onCancel={() => setConfirmingId(null)}
              onDelete={() => void handleDelete(budget.id)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <BudgetForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await loadBudgets();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className={`mt-2 text-lg font-bold ${tone === "positive" ? "text-positive" : tone === "negative" ? "text-rose-700" : "text-slate-800"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {[1, 2].map((item) => (
        <Card key={item}><CardContent className="space-y-4 p-6"><div className="h-5 w-1/3 animate-pulse rounded bg-slate-100" /><div className="h-10 animate-pulse rounded-xl bg-slate-100" /><div className="h-3 animate-pulse rounded-full bg-slate-100" /></CardContent></Card>
      ))}
    </div>
  );
}

function BudgetCard({
  budget,
  confirming,
  deleting,
  onEdit,
  onConfirm,
  onCancel,
  onDelete,
}: {
  budget: BudgetView;
  confirming: boolean;
  deleting: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const status = statusContent[budget.status];
  const progress = Math.min(100, Math.max(0, budget.usagePercent));
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-bold text-slate-900">{budget.name}</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{budget.category || "All categories"} · {formatMonth(budget.startDate.slice(0, 7))}</p>
          </div>
          <p className="shrink-0 text-lg font-bold text-slate-900">{formatCurrency(budget.amountMinor / 100)}</p>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">{formatCurrency(budget.spentMinor / 100)} spent</span>
            <span className={`font-bold ${budget.status === "overspent" ? "text-rose-700" : "text-slate-500"}`}>{budget.usagePercent}% used</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${budget.name} usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, budget.usagePercent))}>
            <div className={`h-full rounded-full transition-all ${status.barClassName}`} style={{ width: `${progress}%` }} />
          </div>
          <p className={`mt-2 text-xs ${budget.remainingMinor < 0 ? "font-semibold text-rose-700" : "text-slate-500"}`}>
            {budget.remainingMinor < 0 ? `${formatCurrency(Math.abs(budget.remainingMinor) / 100)} over the limit` : `${formatCurrency(budget.remainingMinor / 100)} remaining`}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-1 border-t border-border-subtle pt-4">
          {confirming ? (
            <>
              <Button variant="ghost" className="px-2 text-xs" disabled={deleting} onClick={onCancel}>Cancel</Button>
              <Button variant="secondary" className="px-2 text-xs text-rose-700" disabled={deleting} onClick={onDelete}>{deleting ? "Deleting…" : "Confirm delete"}</Button>
            </>
          ) : (
            <>
              <Button variant="icon" aria-label={`Edit ${budget.name}`} title="Edit budget" onClick={onEdit}><Edit3 size={16} /></Button>
              <Button variant="icon" aria-label={`Delete ${budget.name}`} title="Delete budget" onClick={onConfirm} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetForm({ editing, onClose, onSaved }: { editing: BudgetView | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<FormValues>(() => editing ? formFromBudget(editing) : blankForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    let amountMinor: number;
    try {
      amountMinor = amountToMinorUnits(values.amount);
    } catch (amountError) {
      setFieldErrors({ amount: amountError instanceof Error ? amountError.message : "Enter a valid amount." });
      return;
    }
    const range = monthRange(values.month);
    const parsed = budgetCreateSchema.safeParse({
      name: values.name,
      ...(values.category.trim() ? { category: values.category } : {}),
      amountMinor,
      period: "monthly",
      ...range,
    });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])));
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const update: BudgetUpdateInput = parsed.data;
        await updateBudget(editing.id, update);
      } else {
        const create: BudgetCreateInput = parsed.data;
        await createBudget(create);
      }
      await onSaved();
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : "The budget could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="budget-form-title">
      <div className="max-h-[95svh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-surface-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-border-subtle px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">{editing ? "Update budget" : "New budget"}</p>
            <h2 id="budget-form-title" className="mt-1 text-xl font-bold text-slate-950">{editing ? "Edit budget" : "Set a monthly budget"}</h2>
          </div>
          <Button variant="icon" aria-label="Close budget form" onClick={onClose}><X size={19} /></Button>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7" noValidate>
          {submitError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:col-span-2">{submitError}</div>}
          <Field label="Budget name" error={fieldErrors.name}><input autoFocus value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Essentials" className="form-input" /></Field>
          <Field label="Category" error={fieldErrors.category} hint="Optional"><CategoryInput value={values.category} onChange={(value) => update("category", value)} /></Field>
          <Field label="Monthly limit (₹)" error={fieldErrors.amount}><input inputMode="decimal" value={values.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0.00" className="form-input" /></Field>
          <Field label="Month" error={fieldErrors.startDate}><input type="month" value={values.month} onChange={(event) => update("month", event.target.value)} className="form-input" /></Field>
          <div className="rounded-xl bg-surface-muted px-4 py-3 text-xs leading-5 text-slate-500 sm:col-span-2">Only expense transactions in this month count toward usage. Income never reduces a budget.</div>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Create budget"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-600">{label}{hint && <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">({hint})</span>}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-700">{error}</span>}
    </label>
  );
}