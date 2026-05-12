import { Activity, Bot, Inbox } from "lucide-react";
import { StatCard } from "@/components/stat-card";

export default function DashboardPage() {
  return (
    <div className="p-8 lg:p-10">
      <header className="max-w-6xl">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">
          B2B Payment Orchestrator
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Monitor settlement health, AI-driven fee savings, and items that need
          your team&apos;s attention—all in one operational view.
        </p>
      </header>

      <section
        className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Key metrics"
      >
        <StatCard
          title="Total volume"
          value="$48.2M"
          hint="Rolling 30d gross payment volume across all rails."
          icon={Activity}
          accent="emerald"
        />
        <StatCard
          title="Fees saved (AI)"
          value="$312,450"
          hint="Estimated vs. baseline routing from the last reconciliation cycle."
          icon={Bot}
          accent="violet"
        />
        <StatCard
          title="Pending reviews"
          value="14"
          hint="Exceptions and high-value transfers awaiting analyst sign-off."
          icon={Inbox}
          accent="amber"
        />
      </section>
    </div>
  );
}
