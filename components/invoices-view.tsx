"use client";

import { useState, useMemo, useRef } from "react";
import { CheckCircle, Loader2, Upload } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InvoiceRow } from "@/types/invoice";

const CARD_RATE = 0.029;
const CARD_FIXED = 0.30;
const A2A_FLAT_FEE = 0.50;

export type { InvoiceRow };

type InvoicesViewProps = {
  invoices: InvoiceRow[];
  fetchError?: string | null;
};

type FormData = {
  vendor: string;
  amount: string;
  category: string;
  due_date: string;
};

function formatMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function moneySaved(amount: number) {
  return amount * CARD_RATE + CARD_FIXED - A2A_FLAT_FEE;
}

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-colors";

const LABEL_CLASS = "block text-xs font-medium text-zinc-400 mb-1.5";

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-zinc-700">
        —
      </span>
    );
  }
  const high = score > 0.9;
  return (
    <span
      title={`${(score * 100).toFixed(0)}%`}
      className={[
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1",
        high
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25"
          : "bg-amber-500/10 text-amber-300 ring-amber-500/25",
      ].join(" ")}
    >
      {(score * 100).toFixed(0)}%
    </span>
  );
}

export function InvoicesView({ invoices: initial, fetchError }: InvoicesViewProps) {
  const [rows, setRows] = useState<InvoiceRow[]>(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [active, setActive] = useState<InvoiceRow | null>(null);
  const [form, setForm] = useState<FormData>({ vendor: "", amount: "", category: "", due_date: "" });
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "extracting" | "done">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    if (!file) return;

    setUploadError(null);
    setUploadStatus("uploading");

    const supabase = createSupabaseBrowserClient();
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const { error: storageError } = await supabase.storage
      .from("invoice")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (storageError) {
      setUploadError(`Upload failed: ${storageError.message}`);
      setUploadStatus("idle");
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("invoice")
      .getPublicUrl(fileName);

    setUploadStatus("extracting");

    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceUrl: publicUrl }),
    });

    const result = await res.json();

    if (!res.ok) {
      setUploadError(result.error ?? "Extraction failed");
      setUploadStatus("idle");
      return;
    }

    const newRow: InvoiceRow = {
      id: result.id,
      vendor: result.vendor ?? "Unknown",
      amount: result.amount ?? 0,
      date: new Date().toISOString().slice(0, 10),
      suggestedRail: result.suggested_rail === "A2A" ? "A2A" : "Credit Card",
      category: result.category ?? null,
      due_date: result.due_date ?? null,
      status: "pending",
      confidence_score: result.confidence_score ?? null,
    };

    setRows((prev) => [newRow, ...prev]);
    setUploadStatus("done");
    setTimeout(() => setUploadStatus("idle"), 2000);
  }

  const fees = useMemo(() => {
    const amt = parseFloat(form.amount) || 0;
    const cardFee = amt * CARD_RATE + CARD_FIXED;
    return {
      cardFee,
      a2aFee: A2A_FLAT_FEE,
      cheaper:
        cardFee < A2A_FLAT_FEE
          ? ("card" as const)
          : cardFee > A2A_FLAT_FEE
            ? ("a2a" as const)
            : ("tie" as const),
    };
  }, [form.amount]);

  function openReview(row: InvoiceRow) {
    setActive(row);
    setForm({
      vendor: row.vendor,
      amount: String(row.amount),
      category: row.category ?? "",
      due_date: row.due_date ?? "",
    });
    setApproveError(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setActive(null);
    setApproveError(null);
  }

  function patch(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function markVerified(id: string, updates?: Partial<InvoiceRow>) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...updates, status: "verified" } : r,
      ),
    );
  }

  async function handleApprove() {
    if (!active) return;
    setApproving(true);
    setApproveError(null);

    const parsedAmount = parseFloat(form.amount);
    const amount = isNaN(parsedAmount) ? active.amount : parsedAmount;

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "verified",
        vendor: form.vendor.trim() || active.vendor,
        amount,
        category: form.category.trim() || null,
        due_date: form.due_date || null,
      })
      .eq("id", active.id);

    if (error) {
      setApproveError(error.message);
      setApproving(false);
      return;
    }

    markVerified(active.id, {
      vendor: form.vendor.trim() || active.vendor,
      amount,
      category: form.category.trim() || null,
      due_date: form.due_date || null,
    });
    setApproving(false);
    closeSheet();
  }

  async function handleRowApprove(row: InvoiceRow) {
    setApprovingId(row.id);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status: "verified" })
      .eq("id", row.id);
    if (!error) markVerified(row.id);
    setApprovingId(null);
  }

  const isVerified = (row: InvoiceRow) => row.status === "verified";

  return (
    <>
      {fetchError ? (
        <div
          className="mt-10 max-w-6xl rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          Could not load invoices: {fetchError}
        </div>
      ) : null}

      <div className="mt-6 flex max-w-6xl items-center justify-between">
        <div>
          {uploadError && (
            <p className="text-xs text-red-400">{uploadError}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {uploadStatus === "uploading" && (
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
            </span>
          )}
          {uploadStatus === "extracting" && (
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting with AI…
            </span>
          )}
          {uploadStatus === "done" && (
            <span className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" /> Invoice added!
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === "uploading" || uploadStatus === "extracting"}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            Upload Invoice
          </button>
        </div>
      </div>

      <div className="mt-4 max-w-6xl overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm ring-1 ring-zinc-800/50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-4 py-3 font-medium text-zinc-400">Vendor</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Date</th>
                <th className="px-4 py-3 font-medium text-zinc-400 text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Rail</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Confidence</th>
                <th className="px-4 py-3 font-medium text-zinc-400 text-right">Money Saved</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Status</th>
                <th className="px-4 py-3 font-medium text-zinc-400 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-zinc-500"
                  >
                    {fetchError
                      ? "Fix the error above to load rows."
                      : "No invoices yet. Add rows in Supabase to see them here."}
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => {
                const saved = moneySaved(row.amount);
                const isPositive = saved > 0;
                const isBusy = approvingId === row.id;
                return (
                  <tr
                    key={row.id}
                    className="bg-zinc-950/20 transition-colors hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3.5 font-medium text-zinc-100">
                      {row.vendor}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-100">
                      {formatMoney(row.amount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={[
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1",
                          row.suggestedRail === "A2A"
                            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25"
                            : "bg-violet-500/10 text-violet-200 ring-violet-500/25",
                        ].join(" ")}
                      >
                        {row.suggestedRail}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ConfidenceBadge score={row.confidence_score} />
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span
                        className={
                          isPositive ? "text-emerald-400" : "text-red-400"
                        }
                      >
                        {isPositive ? "+" : ""}
                        {formatMoney(saved)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {isVerified(row) ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/25">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isVerified(row) && (
                          <button
                            type="button"
                            onClick={() => handleRowApprove(row)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition-colors hover:bg-emerald-600/40 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3 w-3" />
                            )}
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openReview(row)}
                          className={[
                            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                            isVerified(row)
                              ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                              : "bg-zinc-100 text-zinc-900 hover:bg-white",
                          ].join(" ")}
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          if (!o) closeSheet();
        }}
        title="Review Invoice"
        description={
          active
            ? `${active.vendor} · ${formatMoney(active.amount)}`
            : undefined
        }
      >
        {active ? (
          <div className="space-y-8">
            <section>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Extracted Data
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={LABEL_CLASS} htmlFor="field-vendor">
                    Vendor
                  </label>
                  <input
                    id="field-vendor"
                    type="text"
                    value={form.vendor}
                    onChange={(e) => patch("vendor", e.target.value)}
                    className={FIELD_CLASS}
                    placeholder="Vendor name"
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="field-amount">
                    Amount (USD)
                  </label>
                  <input
                    id="field-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => patch("amount", e.target.value)}
                    className={FIELD_CLASS}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS} htmlFor="field-category">
                      Category
                    </label>
                    <input
                      id="field-category"
                      type="text"
                      value={form.category}
                      onChange={(e) => patch("category", e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="e.g. Software"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS} htmlFor="field-due-date">
                      Due Date
                    </label>
                    <input
                      id="field-due-date"
                      type="date"
                      value={form.due_date}
                      onChange={(e) => patch("due_date", e.target.value)}
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                  <div>
                    <p className={LABEL_CLASS}>Suggested Rail</p>
                    <span
                      className={[
                        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1",
                        active.suggestedRail === "A2A"
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25"
                          : "bg-violet-500/10 text-violet-200 ring-violet-500/25",
                      ].join(" ")}
                    >
                      {active.suggestedRail}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={LABEL_CLASS}>Confidence</p>
                    <ConfidenceBadge score={active.confidence_score} />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Fee Comparison
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                Credit card at <span className="text-zinc-300">2.9% + $0.30</span> vs A2A
                flat fee of <span className="text-zinc-300">$0.50</span>.
              </p>
              <div className="grid gap-3 grid-cols-2">
                <div
                  className={[
                    "rounded-xl border p-4",
                    fees.cheaper === "card"
                      ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : "border-zinc-800 bg-zinc-900/50",
                  ].join(" ")}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Credit Card
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">2.9% + $0.30</p>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-zinc-50">
                    {formatMoney(fees.cardFee)}
                  </p>
                  {fees.cheaper === "card" && (
                    <p className="mt-2 text-xs font-medium text-emerald-400">Lower cost</p>
                  )}
                </div>

                <div
                  className={[
                    "rounded-xl border p-4",
                    fees.cheaper === "a2a"
                      ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : "border-zinc-800 bg-zinc-900/50",
                  ].join(" ")}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    A2A
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Flat per transfer</p>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-zinc-50">
                    {formatMoney(fees.a2aFee)}
                  </p>
                  {fees.cheaper === "a2a" && (
                    <p className="mt-2 text-xs font-medium text-emerald-400">Lower cost</p>
                  )}
                </div>
              </div>
              {fees.cheaper === "tie" && (
                <p className="mt-2 text-center text-xs text-zinc-500">
                  Fees are equal at this amount.
                </p>
              )}
            </section>

            <section className="space-y-3">
              {approveError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-xs text-red-400">
                  {approveError}
                </p>
              ) : null}

              {isVerified(active) ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  This invoice has been verified.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Approving…
                    </>
                  ) : (
                    "Approve & Mark Verified"
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={closeSheet}
                className="w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              >
                Close
              </button>
            </section>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
