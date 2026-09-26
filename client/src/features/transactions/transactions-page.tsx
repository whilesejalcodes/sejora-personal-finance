import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Edit3, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  deleteTransaction,
  getTransactions,
} from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import {
  type TransactionListQuery,
} from "../../../../shared/schemas";
import type { TransactionRecord } from "../../../../shared/types";
import { TransactionForm } from "@/features/transactions/transaction-form";

type Filters = Pick<TransactionListQuery, "q" | "type" | "category" | "sort">;

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: "", type: undefined, category: "", sort: "newest" });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRecord | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTransactions = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setListError(null);
    try {
      const result = await getTransactions({
        ...filters,
        pageSize: 20,
        ...(append && nextCursor ? { pageToken: nextCursor } : {}),
      });
      setTransactions((current) => append ? [...current, ...result.items] : result.items);
      setNextCursor(result.nextCursor);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Transactions could not be loaded.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, nextCursor]);

  useEffect(() => {
    void loadTransactions();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setNextCursor(null);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(transaction: TransactionRecord) {
    setEditing(transaction);
    setFormOpen(true);
    setConfirmingId(null);
  }

  async function handleDelete(transactionId: string) {
    setDeletingId(transactionId);
    try {
      await deleteTransaction(transactionId);
      setTransactions((current) => current.filter((transaction) => transaction.id !== transactionId));
      setConfirmingId(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "The transaction could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  const summary = useMemo(() => {
    const income = transactions.filter((item) => item.type === "income").reduce((total, item) => total + item.amountMinor, 0);
    const expenses = transactions.filter((item) => item.type === "expense").reduce((total, item) => total + item.amountMinor, 0);
    return { income, expenses };
  }, [transactions]);

  return (
    <div>
      <PageHeader
        eyebrow="Your source of truth"
        title="Transactions"
        description="Keep a clear, reliable record of the money moving through your personal workspace."
        action={<Button onClick={openCreate}><Plus size={17} /> Add transaction</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Showing" value={`${transactions.length}${hasNextPage ? "+" : ""}`} />
        <SummaryCard label="Income on page" value={formatCurrency(summary.income / 100)} tone="positive" />
        <SummaryCard label="Expenses on page" value={formatCurrency(summary.expenses / 100)} tone="negative" />
      </div>

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search transactions</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q ?? ""}
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="Search merchant, category, or notes"
              className="auth-input w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none"
            />
          </label>
          <label className="flex min-w-[150px] items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Type</span>
            <select value={filters.type ?? ""} onChange={(event) => updateFilter("type", (event.target.value || undefined) as Filters["type"])} className="auth-input min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none">
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label className="min-w-[160px]">
            <span className="sr-only">Filter by category</span>
            <input value={filters.category ?? ""} onChange={(event) => updateFilter("category", event.target.value)} placeholder="Category" className="auth-input w-full rounded-xl border px-3 py-2.5 text-sm outline-none" />
          </label>
          <label className="flex min-w-[170px] items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Sort</span>
            <select value={filters.sort ?? "newest"} onChange={(event) => updateFilter("sort", event.target.value as Filters["sort"])} className="auth-input min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amountDesc">Largest amount</option>
              <option value="amountAsc">Smallest amount</option>
            </select>
          </label>
        </CardContent>
      </Card>

      {listError && (
        <Card className="mb-5 border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-900">Transactions are unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{listError}</p>
            </div>
            <Button variant="secondary" onClick={() => void loadTransactions()}><RefreshCw size={15} /> Try again</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : transactions.length === 0 ? (
        <EmptyState
          title={filters.q || filters.type || filters.category ? "Nothing matches those filters" : "Nothing recorded yet"}
          description={filters.q || filters.type || filters.category ? "Try a different search or clear a filter." : "Add a transaction and Sejora can start spotting patterns in your money."}
          detail={!filters.q && !filters.type && !filters.category}
          action={<Button onClick={openCreate}><Plus size={16} /> Add transaction</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden border-b border-border-subtle px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 md:grid md:grid-cols-[minmax(76px,1.1fr)_minmax(100px,1.5fr)_minmax(80px,1fr)_minmax(74px,0.9fr)_minmax(82px,1fr)_minmax(98px,1.1fr)_minmax(128px,auto)] md:gap-3">
              <span>Date</span><span>Merchant</span><span>Category</span><span>Type</span><span>Payment</span><span className="text-right">Amount</span><span />
            </div>
            <div className="divide-y divide-border-subtle">
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  confirming={confirmingId === transaction.id}
                  deleting={deletingId === transaction.id}
                  onEdit={() => openEdit(transaction)}
                  onConfirm={() => setConfirmingId(transaction.id)}
                  onCancel={() => setConfirmingId(null)}
                  onDelete={() => void handleDelete(transaction.id)}
                />
              ))}
            </div>
            {hasNextPage && (
              <div className="border-t border-border-subtle p-4 text-center">
                <Button variant="secondary" disabled={loadingMore} onClick={() => void loadTransactions(true)}>
                  {loadingMore ? "Loading more…" : "Load more transactions"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {formOpen && (
        <TransactionForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            setNextCursor(null);
            await loadTransactions();
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
    <Card>
      <CardContent className="space-y-4 p-6">
        {[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
      </CardContent>
    </Card>
  );
}

function TransactionRow({
  transaction,
  confirming,
  deleting,
  onEdit,
  onConfirm,
  onCancel,
  onDelete,
}: {
  transaction: TransactionRecord;
  confirming: boolean;
  deleting: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const positive = transaction.type === "income";
  return (
    <article className="px-5 py-4 md:grid md:grid-cols-[minmax(76px,1.1fr)_minmax(100px,1.5fr)_minmax(80px,1fr)_minmax(74px,0.9fr)_minmax(82px,1fr)_minmax(98px,1.1fr)_minmax(128px,auto)] md:items-center md:gap-3">
      <div className="flex items-center justify-between md:block">
        <p className="text-sm font-semibold text-slate-800">{formatDate(transaction.occurredAt)}</p>
        <p className="text-base font-bold md:hidden">{positive ? "+" : "−"}{formatCurrency(transaction.amountMinor / 100)}</p>
      </div>
      <div className="mt-3 min-w-0 md:mt-0">
        <p className="truncate text-sm font-bold text-slate-800">{transaction.merchant}</p>
        {transaction.notes && <p className="mt-1 truncate text-xs text-slate-400">{transaction.notes}</p>}
      </div>
      <p className="mt-2 text-sm text-slate-600 md:mt-0">{transaction.category || "Uncategorized"}</p>
      <span className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold md:mt-0 ${positive ? "bg-positive/10 text-positive" : "bg-rose-50 text-rose-700"}`}>{positive ? "Income" : "Expense"}</span>
      <p className="mt-2 text-sm text-slate-500 md:mt-0">{transaction.paymentMethod || "—"}</p>
      <p className="hidden text-right text-base font-bold md:block">{positive ? "+" : "−"}{formatCurrency(transaction.amountMinor / 100)}</p>
      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-end gap-1 md:mt-0">
        {confirming ? (
          <>
            <Button variant="ghost" className="whitespace-nowrap px-2 text-xs" disabled={deleting} onClick={onCancel}>Cancel</Button>
            <Button variant="secondary" className="whitespace-nowrap px-2 text-xs text-rose-700" disabled={deleting} onClick={onDelete}>{deleting ? "Deleting…" : "Confirm"}</Button>
          </>
        ) : (
          <>
            <Button variant="icon" aria-label={`Edit ${transaction.merchant}`} title="Edit transaction" onClick={onEdit}><Edit3 size={16} /></Button>
            <Button variant="icon" aria-label={`Delete ${transaction.merchant}`} title="Delete transaction" onClick={onConfirm} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></Button>
          </>
        )}
      </div>
    </article>
  );
}