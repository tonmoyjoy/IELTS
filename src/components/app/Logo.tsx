export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent-btn)" />
        <path d="M9 10.5c2.6-1.2 5-1.2 7 .4 2-1.6 4.4-1.6 7-.4v11c-2.6-1.2-5-1.2-7 .4-2-1.6-4.4-1.6-7-.4z" fill="none" stroke="var(--on-accent)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M16 10.9v11.4" stroke="var(--on-accent)" strokeWidth="1.6" />
      </svg>
      <span className="font-serif text-[17px] font-semibold tracking-tight text-ink">IELTS Practice Studio</span>
    </span>
  );
}
