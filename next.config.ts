import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["mongodb-memory-server"],
  // Allow testing the dev server from other devices on your LAN, e.g. DEV_ALLOWED_ORIGINS=192.168.1.20
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/listening/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/writing/task2", destination: "/practice/writing/task2-community-service", permanent: false },
      { source: "/writing/history", destination: "/history?module=writing", permanent: false },
      { source: "/writing", destination: "/practice/writing", permanent: false },
    ];
  },
};

export default nextConfig;
