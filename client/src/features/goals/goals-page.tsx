import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, Edit3, Flag, Plus, RefreshCw, Target, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryInput } from "@/components/forms/category-input";
import { createGoal, deleteGoal, getGoals, updateGoal } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import { goalCreateSchema, type GoalCreateInput, type GoalUpdateInput } from "../../../../shared/schemas/index.js";
import type { GoalStatus, GoalView } from "../../../../shared/types/index.js";

type FormValues = {
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  category: string;
  notes: string;
};

const todayDate = () => new Date().toISOString().slice(0, 10);

function defaultTargetDate(): string {
  const date = new Date(`${todayDate()}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.toISOString().slice(0, 10);
}

function blankForm(): FormValues {
  return { name: "", targetAmount: "", currentAmount: "0", targetDate: defaultTargetDate(), category: "", notes: "" };
}

function amountToMinorUnits(value: string, allowZero = false): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Enter an amount with up to two decimal places.");
  const [whole, fraction = ""] = normalized.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountMinor) || (allowZero ? amountMinor < 0 : amountMinor <= 0)) {
    throw new Error(allowZero ? "Enter zero or a positive amount." : "Enter an amount greater than zero.");
  }
  return amountMinor;
}

function formFromGoal(goal: GoalView): FormValues {
  return {
    name: goal.name,
    targetAmount: (goal.targetAmountMinor / 100).toFixed(2).replace(/\.00$/, ""),
    currentAmount: (goal.currentAmountMinor / 100).toFixed(2).replace(/\.00$/, ""),
    targetDate: goal.targetDate.slice(0, 10),
    category: goal.category ?? "",
    notes: goal.notes ?? "",
  };
}

const statusContent: Record<GoalStatus, { label: string; className: string; barClassName: string }> = {
  not_started: { label: "Not started", className: "bg-slate-100 text-slate-600", barClassName: "bg-slate-400" },
  in_progress: { label: "In progress", className: "bg-positive/10 text-positive", barClassName: "bg-positive" },
  nearly_there: { label: "Nearly there", className: "bg-amber-50 text-amber-700", barClassName: "bg-amber-500" },
  completed: { label: "Completed", className: "bg-positive/15 text-positive", barClassName: "bg-positive" },
  overdue: { label: "Overdue", className: "bg-rose-50 text-rose-700", barClassName: "bg-rose-600" },
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date.slice(0, 10)}T00:00:00.000Z`));
}

export function GoalsPage() {
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalView | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGoals((await getGoals()).items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Goals could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  const summary = useMemo(() => goals.reduce(
    (result, goal) => ({
      target: result.target + goal.targetAmountMinor,
      current: result.current + goal.currentAmountMinor,
      completed: result.completed + (goal.status === "completed" ? 1 : 0),
    }),
    { target: 0, current: 0, completed: 0 },
  ), [goals]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(goal: GoalView) {
    setEditing(goal);
    setConfirmingId(null);
    setFormOpen(true);
  }

  async function handleDelete(goalId: string) {
    setDeletingId(goalId);
    try {
      await deleteGoal(goalId);
      setGoals((current) => current.filter((goal) => goal.id !== goalId));
      setConfirmingId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The goal could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Give future priorities a shape"
        title="Goals"
        description="Set a target for something that matters to you and track progress from a clear, current baseline."
        motif
        action={<Button onClick={openCreate}><Plus size={17} /> Add goal</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Goals" value={goals.length.toString()} />
        <SummaryCard label="Total target" value={formatCurrency(summary.target / 100)} />
        <SummaryCard label="Completed" value={`${summary.completed} of ${goals.length}`} tone="positive" />
      </div>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-bold text-rose-900">Goals are unavailable</p><p className="mt-1 text-sm text-rose-800">{error}</p></div>
            <Button variant="secondary" onClick={() => void loadGoals()}><RefreshCw size={15} /> Try again</Button>
          </CardContent>
        </Card>
      )}

      {loading ? <LoadingState /> : goals.length === 0 ? (
        <EmptyState title="Give your money somewhere to go" description="Set a target for something that matters and keep its progress visible." detail action={<Button onClick={openCreate}><Plus size={16} /> Add your first goal</Button>} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              confirming={confirmingId === goal.id}
              deleting={deletingId === goal.id}
              onEdit={() => openEdit(goal)}
              onConfirm={() => setConfirmingId(goal.id)}
              onCancel={() => setConfirmingId(null)}
              onDelete={() => void handleDelete(goal.id)}
            />
          ))}
        </div>
      )}

      {formOpen && <GoalForm editing={editing} onClose={() => setFormOpen(false)} onSaved={async () => { setFormOpen(false); await loadGoals(); }} />}
    </div>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" }) {
  return <Card><CardContent className="min-h-[92px] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className={`mt-2 text-xl font-bold ${tone === "positive" ? "text-positive" : "text-slate-800"}`}>{value}</p></CardContent></Card>;
}

function LoadingState() {
  return <div className="grid gap-4 xl:grid-cols-2" aria-label="Loading goals">{[1, 2].map((item) => <Card key={item}><CardContent className="space-y-4 p-6"><div className="h-5 w-1/3 animate-pulse rounded bg-slate-100" /><div className="h-10 animate-pulse rounded-xl bg-slate-100" /><div className="h-3 animate-pulse rounded-full bg-slate-100" /></CardContent></Card>)}</div>;
}

function GoalCard({ goal, confirming, deleting, onEdit, onConfirm, onCancel, onDelete }: { goal: GoalView; confirming: boolean; deleting: boolean; onEdit: () => void; onConfirm: () => void; onCancel: () => void; onDelete: () => void }) {
  const status = statusContent[goal.status];
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-bold text-slate-900">{goal.name}</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{goal.category || "Personal goal"} · Target {formatDate(goal.targetDate)}</p>
          </div>
          <Target size={19} className={goal.status === "overdue" ? "text-rose-600" : "text-positive"} />
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div><p className="text-2xl font-bold tracking-[-0.04em] text-slate-900">{formatCurrency(goal.currentAmountMinor / 100)}</p><p className="mt-1 text-xs text-slate-500">of {formatCurrency(goal.targetAmountMinor / 100)} target</p></div>
          <p className="text-lg font-bold text-slate-700">{goal.percentageComplete}%</p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={goal.percentageComplete}><div className={`h-full rounded-full ${status.barClassName}`} style={{ width: `${goal.percentageComplete}%` }} /></div>
        <div className="mt-3 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{goal.status === "completed" ? "Target reached" : `${formatCurrency(goal.remainingAmountMinor / 100)} remaining`}</span><span className={goal.status === "overdue" ? "font-bold text-rose-700" : "text-slate-500"}>{goal.status === "overdue" ? "Target date passed" : formatDate(goal.targetDate)}</span></div>
        {goal.notes && <p className="mt-4 rounded-xl bg-surface-muted px-3 py-2 text-xs leading-5 text-slate-500">{goal.notes}</p>}

        <div className="mt-5 flex justify-end gap-1 border-t border-border-subtle pt-4">
          {confirming ? <><Button variant="ghost" className="px-2 text-xs" disabled={deleting} onClick={onCancel}>Cancel</Button><Button variant="secondary" className="px-2 text-xs text-rose-700" disabled={deleting} onClick={onDelete}>{deleting ? "Deleting…" : "Confirm delete"}</Button></> : <><Button variant="icon" aria-label={`Edit ${goal.name}`} title="Edit goal" onClick={onEdit}><Edit3 size={16} /></Button><Button variant="icon" aria-label={`Delete ${goal.name}`} title="Delete goal" onClick={onConfirm} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></Button></>}
        </div>
      </CardContent>
    </Card>
  );
}

function GoalForm({ editing, onClose, onSaved }: { editing: GoalView | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<FormValues>(() => editing ? formFromGoal(editing) : blankForm());
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
    let targetAmountMinor: number;
    let currentAmountMinor: number;
    try {
      targetAmountMinor = amountToMinorUnits(values.targetAmount);
      currentAmountMinor = amountToMinorUnits(values.currentAmount, true);
    } catch (amountError) {
      setFieldErrors({ targetAmount: amountError instanceof Error ? amountError.message : "Enter a valid amount." });
      return;
    }
    const parsed = goalCreateSchema.safeParse({
      name: values.name,
      targetAmountMinor,
      currentAmountMinor,
      targetDate: values.targetDate,
      ...(values.category.trim() ? { category: values.category } : {}),
      ...(values.notes.trim() ? { notes: values.notes } : {}),
    });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])));
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const update: GoalUpdateInput = parsed.data;
        await updateGoal(editing.id, update);
      } else {
        const create: GoalCreateInput = parsed.data;
        await createGoal(create);
      }
      await onSaved();
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : "The goal could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="goal-form-title">
      <div className="max-h-[95svh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-surface-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-border-subtle px-5 py-5 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">{editing ? "Update goal" : "New goal"}</p><h2 id="goal-form-title" className="mt-1 text-xl font-bold text-slate-950">{editing ? "Edit goal" : "Create a savings goal"}</h2></div><Button variant="icon" aria-label="Close goal form" onClick={onClose}><X size={19} /></Button></div>
        <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7" noValidate>
          {submitError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:col-span-2">{submitError}</div>}
          <Field label="Goal name" error={fieldErrors.name}><input autoFocus value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Emergency fund" className="form-input" /></Field>
          <Field label="Category" error={fieldErrors.category} hint="Optional"><CategoryInput value={values.category} onChange={(value) => update("category", value)} /></Field>
          <Field label="Target amount (₹)" error={fieldErrors.targetAmount}><input inputMode="decimal" value={values.targetAmount} onChange={(event) => update("targetAmount", event.target.value)} placeholder="0.00" className="form-input" /></Field>
          <Field label="Current amount (₹)" error={fieldErrors.currentAmount}><input inputMode="decimal" value={values.currentAmount} onChange={(event) => update("currentAmount", event.target.value)} placeholder="0.00" className="form-input" /></Field>
          <Field label="Target date" error={fieldErrors.targetDate}><input type="date" value={values.targetDate} onChange={(event) => update("targetDate", event.target.value)} className="form-input" /></Field>
          <Field label="Notes" error={fieldErrors.notes} hint="Optional"><input value={values.notes} onChange={(event) => update("notes", event.target.value)} placeholder="What is this for?" className="form-input" /></Field>
          <div className="flex items-start gap-2 rounded-xl bg-surface-muted px-4 py-3 text-xs leading-5 text-slate-500 sm:col-span-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-positive" />Progress is tracked manually from the amounts you record here. Current amount cannot exceed the target.</div>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Create goal"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return <label><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-600">{label}{hint && <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">({hint})</span>}</span>{children}{error && <span className="mt-1.5 block text-xs font-medium text-rose-700">{error}</span>}</label>;
}