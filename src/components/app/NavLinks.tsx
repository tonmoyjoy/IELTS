"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/practice/listening", label: "Listening" },
  { href: "/practice/reading", label: "Reading" },
  { href: "/practice/writing", label: "Writing" },
  { href: "/practice/speaking", label: "Speaking" },
  { href: "/history", label: "History" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
