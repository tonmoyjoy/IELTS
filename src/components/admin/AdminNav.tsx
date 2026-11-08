import { Chip } from "@/components/ui";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Chip key={tab.href} href={tab.href} active={tab.href === active}>
          {tab.label}
        </Chip>
      ))}
    </nav>
  );
}

export const STATUS_STYLES: Record<string, string> = {
  paid: "bg-good-soft text-good",
  review: "bg-warn-soft text-warn",
  pending: "bg-info-soft text-info",
  failed: "bg-bad-soft text-bad",
  cancelled: "bg-sunken text-ink-soft",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] ?? "bg-sunken text-ink-soft"}`}>
      {status === "review" ? "Under review" : status}
    </span>
  );
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
