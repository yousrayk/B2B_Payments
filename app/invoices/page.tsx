import { InvoicesView } from "@/components/invoices-view";
import { fetchAllInvoices } from "@/lib/invoices";

export const dynamic = "force-dynamic";

/** Ensures fs-based `.env.local` reads run in Node, not Edge. */
export const runtime = "nodejs";

export default async function InvoicesPage() {
  const { data, error } = await fetchAllInvoices();

  return (
    <div className="p-8 lg:p-10">
      <header className="max-w-6xl">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">
          B2B Payment Orchestrator
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
          Invoices
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Payable invoices with AI-suggested rails. Open a row to compare card
          versus account-to-account fees before you approve.
        </p>
      </header>
      <InvoicesView invoices={data} fetchError={error} />
    </div>
  );
}
