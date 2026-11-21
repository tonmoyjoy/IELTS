"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/practice/listening", label: "Listening" },
  { href: "/practice/reading", label: "Reading" },
  { href: "/practice/writing", label: "Writing" },
  { href: "/practice/speaking", label: "Speaking" },
  { href: "/practice/mock", label: "Mock test" },
  { href: "/history", label: "History" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto pb-1 md:order-none md:mx-0 md:w-auto md:pb-0">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-accent-soft text-accent-text" : "text-ink-soft hover:bg-sunken hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
