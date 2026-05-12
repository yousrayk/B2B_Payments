import type { InvoiceRow } from "@/types/invoice";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RawInvoice = Record<string, unknown>;

function pickDate(row: RawInvoice): string | null {
  const raw = row.invoice_date ?? row.date ?? row.created_at;
  if (raw == null) return null;
  return String(raw).slice(0, 10);
}

function normalizeRail(value: unknown): InvoiceRow["suggestedRail"] {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (s === "a2a" || s === "account_to_account") return "A2A";
  return "Credit Card";
}

function mapRow(row: RawInvoice): InvoiceRow | null {
  const id = row.id;
  const vendor = row.vendor;
  const amount = row.amount;
  if (id == null || vendor == null || amount == null) return null;

  const date = pickDate(row);
  if (!date) return null;

  return {
    id: String(id),
    vendor: String(vendor),
    date,
    amount: Number(amount),
    suggestedRail: normalizeRail(row.suggested_rail),
    category: row.category != null ? String(row.category) : null,
    due_date: row.due_date != null ? String(row.due_date).slice(0, 10) : null,
    status: row.status != null ? String(row.status) : null,
    confidence_score:
      row.confidence_score != null ? Number(row.confidence_score) : null,
  };
}

/**
 * Loads every row from the `invoices` table.
 * Expected columns: id, vendor, amount, suggested_rail, and either invoice_date or date (ISO or date string).
 */
export async function fetchAllInvoices(): Promise<{
  data: InvoiceRow[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("invoices").select("*");

    if (error) {
      return { data: [], error: error.message };
    }

    const rows = (data as RawInvoice[] | null) ?? [];
    const mapped = rows
      .map(mapRow)
      .filter((r): r is InvoiceRow => r !== null);

    mapped.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return { data: mapped, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { data: [], error: message };
  }
}
