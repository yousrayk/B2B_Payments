import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: "emerald" | "violet" | "amber";
};

const accentStyles = {
  emerald: {
    iconWrap: "bg-emerald-500/15 ring-emerald-500/25",
    icon: "text-emerald-400",
  },
  violet: {
    iconWrap: "bg-violet-500/15 ring-violet-500/25",
    icon: "text-violet-300",
  },
  amber: {
    iconWrap: "bg-amber-500/15 ring-amber-500/30",
    icon: "text-amber-400",
  },
} as const;

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent,
}: StatCardProps) {
  const a = accentStyles[accent];
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/80 to-zinc-950/40 p-5 shadow-sm ring-1 ring-zinc-800/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
            {value}
          </p>
          <p className="mt-2 text-sm text-zinc-500">{hint}</p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${a.iconWrap}`}
        >
          <Icon className={`h-5 w-5 ${a.icon}`} aria-hidden />
        </div>
      </div>
    </div>
  );
}
