import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CategoryInput } from "@/components/forms/category-input";
import { PaymentMethodInput } from "@/components/forms/payment-method-input";
import { createTransaction, updateTransaction } from "@/lib/api-client";
import { isCategoryRequired, transactionCreateSchema, type TransactionCreateInput, type TransactionUpdateInput } from "../../../../shared/schemas";
import type { TransactionRecord } from "../../../../shared/types";
import { MERCHANT_SUGGESTIONS } from "@/lib/finance-options";

type FormValues = {
  amount: string;
  type: "income" | "expense";
  merchant: string;
  category: string;
  occurredAt: string;
  paymentMethod: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function blankForm(): FormValues {
  return {
    amount: "",
    type: "expense",
    merchant: "",
    category: "",
    occurredAt: today(),
    paymentMethod: "",
    notes: "",
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

function formFromTransaction(transaction: TransactionRecord): FormValues {
  return {
    amount: (transaction.amountMinor / 100).toFixed(2).replace(/\.00$/, ""),
    type: transaction.type,
    merchant: transaction.merchant,
    category: transaction.category ?? "",
    occurredAt: transaction.occurredAt.slice(0, 10),
    paymentMethod: transaction.paymentMethod ?? "",
    notes: transaction.notes ?? "",
  };
}

function getValidationMessages(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));
}

export function TransactionForm({ editing, onClose, onSaved }: { editing: TransactionRecord | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<FormValues>(() => editing ? formFromTransaction(editing) : blankForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function handleTypeChange(type: FormValues["type"]) {
    update("type", type);
    if (!isCategoryRequired(type)) {
      setFieldErrors((current) => {
        const { category: _category, ...rest } = current;
        return rest;
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    let amountMinor: number;
    try {
      amountMinor = amountToMinorUnits(values.amount);
    } catch (error) {
      setFieldErrors({ amount: error instanceof Error ? error.message : "Enter a valid amount." });
      return;
    }
    const parsed = transactionCreateSchema.safeParse({
      amountMinor,
      type: values.type,
      merchant: values.merchant,
      ...(isCategoryRequired(values.type) ? { category: values.category } : {}),
      occurredAt: values.occurredAt,
      ...(values.paymentMethod.trim() ? { paymentMethod: values.paymentMethod } : {}),
      ...(values.notes.trim() ? { notes: values.notes } : {}),
    });
    if (!parsed.success) {
      setFieldErrors(getValidationMessages(parsed.error));
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const update: TransactionUpdateInput = parsed.data;
        await updateTransaction(editing.id, update);
      } else {
        const create: TransactionCreateInput = parsed.data;
        await createTransaction(create);
      }
      await onSaved();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The transaction could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
      <div className="max-h-[95svh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-border-subtle px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">{editing ? "Update ledger entry" : "New ledger entry"}</p>
            <h2 id="transaction-form-title" className="mt-1 text-xl font-bold text-slate-950">{editing ? "Edit transaction" : "Add transaction"}</h2>
          </div>
          <Button variant="icon" aria-label="Close transaction form" onClick={onClose}><X size={19} /></Button>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7" noValidate>
          {submitError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:col-span-2">{submitError}</div>}
          <Field label="Amount (₹)" required error={fieldErrors.amount}><input autoFocus inputMode="decimal" value={values.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0.00" className="form-input" /></Field>
          <Field label="Type" required error={fieldErrors.type}><select value={values.type} onChange={(event) => handleTypeChange(event.target.value as FormValues["type"])} className="form-input"><option value="expense">Expense</option><option value="income">Income</option></select></Field>
          <Field label="Merchant" required error={fieldErrors.merchant}>
            <input list="merchant-suggestions" value={values.merchant} onChange={(event) => update("merchant", event.target.value)} placeholder="Search or enter merchant..." className="form-input" />
            <datalist id="merchant-suggestions">{MERCHANT_SUGGESTIONS.map((merchant) => <option key={merchant} value={merchant} />)}</datalist>
          </Field>
          {isCategoryRequired(values.type) && <Field label="Category" required error={fieldErrors.category}><CategoryInput value={values.category} onChange={(value) => update("category", value)} required /></Field>}
          <Field label="Date" required error={fieldErrors.occurredAt}><input type="date" value={values.occurredAt} onChange={(event) => update("occurredAt", event.target.value)} className="form-input" /></Field>
          <Field label="Payment method" hint="Optional" error={fieldErrors.paymentMethod}><PaymentMethodInput value={values.paymentMethod} onChange={(value) => update("paymentMethod", value)} /></Field>
          <Field label="Notes" hint="Optional" error={fieldErrors.notes} className="sm:col-span-2"><textarea value={values.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional context for this transaction" rows={3} className="form-input resize-y" /></Field>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Add transaction"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required = false, hint, error, className, children }: { label: string; required?: boolean; hint?: ReactNode; error?: string; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-600">
        {label} {required ? <span className="text-rose-600" aria-hidden="true">*</span> : <span className="font-normal normal-case tracking-normal text-slate-400">({hint ?? "Optional"})</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-700">{error}</span>}
    </label>
  );
}