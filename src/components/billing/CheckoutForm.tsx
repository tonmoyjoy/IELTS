"use client";

import { useState } from "react";
import { apiFetch, firstFieldError } from "@/lib/api-client";
import { Alert, Button, inputClass, labelClass } from "@/components/ui";
import { BILLING_OPTIONS, formatBdt, type BillingOptionId } from "@/lib/plans";

const METHODS = ["bKash", "Nagad", "Rocket", "Visa", "Mastercard", "Amex"];

export function CheckoutForm({ initialOption, extending }: { initialOption: BillingOptionId; extending: boolean }) {
  const [optionId, setOptionId] = useState<BillingOptionId>(initialOption);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]> | undefined>();

  const selected = BILLING_OPTIONS.find((o) => o.id === optionId)!;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields(undefined);
    setPending(true);
    const res = await apiFetch<{ url: string }>("/api/billing/checkout", { body: { optionId, name, phone } });
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      setFields(res.fields);
      return;
    }
    // Hand over to SSLCommerz's hosted, PCI-compliant payment page.
    window.location.assign(res.data.url);
  }

  const nameError = firstFieldError(fields, "name");
  const phoneError = firstFieldError(fields, "phone");

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset>
        <legend className={labelClass}>Choose a plan</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {BILLING_OPTIONS.map((option) => {
            const active = option.id === optionId;
            return (
              <label
                key={option.id}
                className={`relative cursor-pointer rounded-2xl border p-4 transition-colors ${
                  active ? "border-accent bg-accent-soft/60 ring-1 ring-accent" : "border-line-strong hover:bg-sunken"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={option.id}
                  checked={active}
                  onChange={() => setOptionId(option.id)}
                  className="sr-only"
                />
                <span className="block text-sm font-medium text-ink-soft">{option.label}</span>
                <span className="mt-1 block font-serif text-2xl font-semibold text-ink">{formatBdt(option.amountBdt)}</span>
                {option.note && <span className="mt-1 block text-xs font-medium text-accent-text">{option.note}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="billing-name" className={labelClass}>Full name</label>
          <input id="billing-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(nameError)} className={inputClass} />
          {nameError && <p className="mt-1 text-xs text-bad">{nameError}</p>}
        </div>
        <div>
          <label htmlFor="billing-phone" className={labelClass}>Mobile number</label>
          <input id="billing-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01712345678" value={phone}
            onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(phoneError)} className={inputClass} />
          {phoneError && <p className="mt-1 text-xs text-bad">{phoneError}</p>}
        </div>
      </div>

      {error && !nameError && !phoneError && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-sunken px-5 py-4">
        <div className="text-sm">
          <p className="font-medium text-ink">
            Pro for {selected.days} days · {formatBdt(selected.amountBdt)}
          </p>
          <p className="text-ink-soft">{extending ? "Added on top of your current Pro period." : "One-time payment. No automatic renewal."}</p>
        </div>
        <Button type="submit" disabled={pending} className="px-6">
          {pending ? "Opening secure checkout…" : `Pay ${formatBdt(selected.amountBdt)}`}
        </Button>
      </div>

      <div>
        <p className="text-xs text-ink-faint">You&apos;ll complete payment on SSLCommerz&apos;s secure page using:</p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Accepted payment methods">
          {METHODS.map((method) => (
            <li key={method} className="rounded-lg border border-line bg-raised px-2.5 py-1 text-xs font-semibold text-ink-soft">
              {method}
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
