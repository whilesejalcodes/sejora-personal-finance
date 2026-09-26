import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, FileScan, ImagePlus, LoaderCircle, RotateCcw, ScanLine, Upload, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryInput } from "@/components/forms/category-input";
import { PaymentMethodInput } from "@/components/forms/payment-method-input";
import { createTransaction, scanReceipt } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import { isCategoryRequired, transactionCreateSchema, type TransactionCreateInput } from "../../../../shared/schemas/index.js";
import type { ReceiptExtraction, ReceiptReviewField } from "../../../../shared/types/index.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ReviewValues = {
  merchant: string;
  occurredAt: string;
  amount: string;
  type: "" | "income" | "expense";
  currency: "" | "INR";
  category: string;
  paymentMethod: string;
};

function amountToMinor(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Enter an amount with up to two decimal places.");
  const [whole, fraction = ""] = normalized.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("Enter an amount greater than zero.");
  return amountMinor;
}

function formatAmount(value: number | null): string {
  return value === null ? "" : (value / 100).toFixed(2).replace(/\.00$/, "");
}

function formFromExtraction(extraction: ReceiptExtraction): ReviewValues {
  return {
    merchant: extraction.merchant ?? "",
    occurredAt: extraction.occurredAt ?? "",
    amount: formatAmount(extraction.amountMinor),
    type: extraction.type ?? "",
    currency: extraction.currency ?? "",
    category: extraction.category ?? "",
    paymentMethod: extraction.paymentMethod ?? "",
  };
}

function reviewLabel(field: ReceiptReviewField): string {
  return {
    merchant: "Merchant",
    occurredAt: "Date",
    amountMinor: "Amount",
    type: "Type",
    category: "Category",
    currency: "Currency",
  }[field];
}

export function ReceiptScannerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [reviewValues, setReviewValues] = useState<ReviewValues | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setScanError(null);
    setSaveError(null);
    setSaved(false);
    setExtraction(null);
    setReviewValues(null);
    if (!selected) return;
    if (!SUPPORTED_TYPES.includes(selected.type)) {
      setFile(null);
      setScanError("Use a JPEG, PNG, or WebP receipt image.");
      return;
    }
    if (selected.size === 0) {
      setFile(null);
      setScanError("The selected image is empty.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setScanError("Receipt images must be 5 MB or smaller.");
      return;
    }
    setFile(selected);
  }

  function updateReview<Key extends keyof ReviewValues>(key: Key, value: ReviewValues[Key]) {
    setReviewValues((current) => current ? { ...current, [key]: value } : current);
    setSaveError(null);
  }

  async function handleScan() {
    if (!file) return;
    setScanning(true);
    setScanError(null);
    setSaveError(null);
    setSaved(false);
    try {
      const result = await scanReceipt(file);
      setExtraction(result.extraction);
      setReviewValues(formFromExtraction(result.extraction));
      setScanMessage(result.reviewMessage);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "The receipt could not be scanned.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!reviewValues) return;
    setSaveError(null);
    let amountMinor: number;
    if (reviewValues.currency !== "INR") {
      setSaveError("Confirm that this receipt is denominated in INR before saving.");
      return;
    }
    try {
      amountMinor = amountToMinor(reviewValues.amount);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Enter a valid amount.");
      return;
    }
    const parsed = transactionCreateSchema.safeParse({
      amountMinor,
      type: reviewValues.type,
      merchant: reviewValues.merchant,
      ...(reviewValues.type === "expense" ? { category: reviewValues.category } : {}),
      occurredAt: reviewValues.occurredAt,
      ...(reviewValues.paymentMethod.trim() ? { paymentMethod: reviewValues.paymentMethod } : {}),
      source: "receipt",
    });
    if (!parsed.success) {
      setSaveError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    setSaving(true);
    try {
      const create: TransactionCreateInput = parsed.data;
      await createTransaction(create);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The transaction could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setFile(null);
    setExtraction(null);
    setReviewValues(null);
    setScanError(null);
    setScanMessage(null);
    setSaveError(null);
    setSaved(false);
    setFileInputKey((value) => value + 1);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Turn paper into a reviewed record"
        title="Receipt scanner"
        description="Scan a receipt, review the extracted details, and confirm it before it enters your transaction ledger."
        action={file && <Button type="button" variant="secondary" onClick={reset}><RotateCcw size={16} /> Start over</Button>}
      />

      {saved ? (
        <Card className="border-positive/25 bg-surface-positive">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-positive/10 text-positive"><CheckCircle2 size={25} /></span>
            <div><h2 className="font-bold text-ink-950">Receipt reviewed and saved</h2><p className="mt-1 text-sm text-positive">The confirmed details are now part of your transaction ledger.</p></div>
            <Button type="button" className="sm:ml-auto" variant="secondary" onClick={reset}>Scan another receipt</Button>
          </CardContent>
        </Card>
      ) : !file ? (
        <UploadState fileInputKey={fileInputKey} error={scanError} onChange={chooseFile} />
      ) : !extraction || !reviewValues ? (
        <SelectedFileState file={file} previewUrl={previewUrl} scanning={scanning} error={scanError} onScan={() => void handleScan()} />
      ) : (
        <ReviewState extraction={extraction} values={reviewValues} message={scanMessage} saving={saving} error={saveError} onUpdate={updateReview} onSave={() => void handleSave()} />
      )}
    </div>
  );
}

function UploadState({ fileInputKey, error, onChange }: { fileInputKey: number; error: string | null; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <Card>
      <CardContent className="p-6 sm:p-10">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-100 bg-surface-brand px-6 py-14 text-center transition-colors hover:border-brand-600 hover:bg-brand-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700"><ImagePlus size={26} /></span>
          <span className="mt-5 text-lg font-bold text-slate-900">Choose a receipt image</span>
          <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">Upload a clear JPEG, PNG, or WebP image. The image is processed for extraction and is not permanently stored.</span>
          <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"><Upload size={16} /> Select receipt</span>
          <input key={fileInputKey} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChange} />
        </label>
        {error ? <ErrorNotice message={error} /> : <p className="mt-4 text-center text-xs text-slate-400">Maximum file size: 5 MB · Supported: JPEG, PNG, WebP</p>}
      </CardContent>
    </Card>
  );
}

function SelectedFileState({ file, previewUrl, scanning, error, onScan }: { file: File; previewUrl: string | null; scanning: boolean; error: string | null; onScan: () => void }) {
  return (
    <Card>
      <CardHeader><div><h2 className="text-base font-bold text-slate-900">Ready to scan</h2><p className="mt-1 text-xs text-muted">Check the preview, then send this image for structured extraction.</p></div><FileScan size={19} className="text-brand-600" /></CardHeader>
      <CardContent className="pt-5">
        <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-slate-100"><img src={previewUrl ?? ""} alt="Selected receipt preview" className="max-h-[360px] w-full object-contain" /></div>
          <div><p className="break-all text-sm font-bold text-slate-800">{file.name}</p><p className="mt-1 text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · {file.type}</p><div className="mt-5 rounded-xl bg-surface-muted px-4 py-3 text-xs leading-5 text-slate-500">Gemini will extract visible receipt details only. Nothing is saved until you review and confirm the fields.</div><Button type="button" className="mt-5" disabled={scanning} onClick={(event) => { event.preventDefault(); onScan(); }}>{scanning ? <><LoaderCircle size={16} className="animate-spin" /> Analyzing receipt…</> : <><ScanLine size={16} /> Scan receipt</>}</Button>{error && <ErrorNotice message={error} />}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewState({ extraction, values, message, saving, error, onUpdate, onSave }: { extraction: ReceiptExtraction; values: ReviewValues; message: string | null; saving: boolean; error: string | null; onUpdate: <Key extends keyof ReviewValues>(key: Key, value: ReviewValues[Key]) => void; onSave: () => void }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <Card>
        <CardHeader><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">Review required</p><h2 className="mt-1 text-lg font-bold text-slate-900">Confirm extracted details</h2><p className="mt-1 text-xs text-muted">{message}</p></div><ScanLine size={19} className="text-amber-600" /></CardHeader>
        <CardContent className="pt-5">
          {extraction.needsReview.length > 0 && <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>Needs review: {extraction.needsReview.map(reviewLabel).join(", ")}. Missing details must be completed before saving.</span></div>}
          {error && <ErrorNotice message={error} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <ReviewField label="Merchant" value={values.merchant} onChange={(value) => onUpdate("merchant", value)} />
            <ReviewField label="Date" type="date" value={values.occurredAt} onChange={(value) => onUpdate("occurredAt", value)} />
            <ReviewField label="Amount (₹)" inputMode="decimal" value={values.amount} onChange={(value) => onUpdate("amount", value)} />
            <label><span className="form-label">Type</span><select value={values.type} onChange={(event) => onUpdate("type", event.target.value as ReviewValues["type"])} className="form-input"><option value="">Choose type</option><option value="expense">Expense</option><option value="income">Income</option></select></label>
            <label><span className="form-label">Currency</span><select value={values.currency} onChange={(event) => onUpdate("currency", event.target.value as ReviewValues["currency"])} className="form-input"><option value="">Confirm currency</option><option value="INR">INR / ₹</option></select></label>
            {values.type === "expense" && <label><span className="form-label">Category</span><CategoryInput value={values.category} onChange={(value) => onUpdate("category", value)} required /></label>}
            {values.type !== "expense" && <label><span className="form-label">Category <span className="font-normal normal-case tracking-normal text-slate-400">(Optional)</span></span><CategoryInput value={values.category} onChange={(value) => onUpdate("category", value)} /></label>}
            <label><span className="form-label">Payment method <span className="font-normal normal-case tracking-normal text-slate-400">(Optional)</span></span><PaymentMethodInput value={values.paymentMethod} onChange={(value) => onUpdate("paymentMethod", value)} /></label>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => window.location.reload()}>Discard review</Button><Button type="button" disabled={saving} onClick={onSave}>{saving ? "Saving transaction…" : "Confirm and save transaction"}</Button></div>
        </CardContent>
      </Card>
      <LineItemsCard items={extraction.lineItems} />
    </div>
  );
}

function ReviewField({ label, value, onChange, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "decimal" }) {
  return <label><span className="form-label">{label}</span><input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} className="form-input" /></label>;
}

function LineItemsCard({ items }: { items: ReceiptExtraction["lineItems"] }) {
  return <Card><CardHeader><div><h2 className="text-base font-bold text-slate-900">Visible line items</h2><p className="mt-1 text-xs text-muted">{items.length ? "Read-only context from the receipt." : "No line items were clearly extracted."}</p></div></CardHeader><CardContent className="pt-5">{items.length ? <div className="space-y-3">{items.map((item, index) => <div key={`${item.description}-${index}`} className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-700">{item.description}</p>{item.quantity !== null && <p className="mt-1 text-xs text-slate-400">Qty {item.quantity}{item.unitPriceMinor !== null ? ` · ${formatCurrency(item.unitPriceMinor / 100)} each` : ""}</p>}</div><p className="shrink-0 text-sm font-bold text-slate-800">{item.totalMinor !== null ? formatCurrency(item.totalMinor / 100) : "—"}</p></div>)}</div> : <EmptyState compact title="No line items to review" description="The receipt total and other fields can still be reviewed below." />}</CardContent></Card>;
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><X size={16} className="mt-0.5 shrink-0" />{message}</div>;
}