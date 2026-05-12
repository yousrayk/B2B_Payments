"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex justify-end",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={[
          "absolute inset-0 bg-black/60 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={() => onOpenChange(false)}
        aria-label="Close panel"
        tabIndex={open ? 0 : -1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={[
          "relative flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
          <div className="min-w-0">
            <h2
              id="sheet-title"
              className="text-lg font-semibold tracking-tight text-zinc-50"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
