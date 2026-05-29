function maskIp(ip: string | undefined) {
  if (!ip) return undefined;
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : "redacted";
  }
  return ip.slice(0, 8);
}

function sanitize(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        if (/(password|token|cookie|secret|authorization|email)/i.test(key)) {
          return [];
        }
        if (key === "ip" && typeof entry === "string") {
          return [[key, maskIp(entry)]];
        }
        return [[key, sanitize(entry)]];
      })
    );
  }
  return value;
}

export function logSecurityEvent(
  action: string,
  metadata: Record<string, unknown> = {},
  level: "info" | "warn" = "info"
) {
  const logger = level === "warn" ? console.warn : console.info;
  logger(
    `[security] ${JSON.stringify({
      action,
      at: new Date().toISOString(),
      ...sanitize(metadata),
    })}`
  );
}

