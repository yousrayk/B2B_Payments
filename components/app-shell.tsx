"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  FileText,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/95 backdrop-blur">
        <div className="flex h-16 items-center gap-2 border-b border-zinc-800/80 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-100">
              Payment Orchestrator
            </p>
            <p className="truncate text-xs text-zinc-500">B2B control plane</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-800/80 text-white shadow-sm ring-1 ring-zinc-700/80"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-800/80 p-4">
          <div className="flex items-start gap-3 rounded-lg bg-zinc-900/60 p-3 ring-1 ring-zinc-800">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-medium text-zinc-200">AI routing on</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Fee optimization and exception triage are active for this
                workspace.
              </p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
