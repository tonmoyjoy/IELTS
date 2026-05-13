/** Shape of JSON error responses from /api/auth/* routes */
export function formatAuthApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed";
  const err = data as { error?: unknown; fields?: unknown };
  if (typeof err.error === "string" && err.error.length > 0) {
    const base = err.error;
    if (err.fields && typeof err.fields === "object" && err.fields !== null) {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(err.fields as Record<string, unknown>)) {
        if (Array.isArray(v) && v.length) parts.push(`${k}: ${v.join(", ")}`);
      }
      if (parts.length) return `${base} (${parts.join("; ")})`;
    }
    return base;
  }
  return "Request failed";
}
