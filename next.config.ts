import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Lets phones/laptops on the same Wi-Fi open the dev server via its
 * "Network" URL (e.g. http://192.168.0.107:3000). Dev only; covers every
 * private IPv4 range plus mDNS *.local names.
 */
const PRIVATE_NETWORK_DEV_ORIGINS = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  "*.local",
];

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
  allowedDevOrigins: [
    ...PRIVATE_NETWORK_DEV_ORIGINS,
    // Anything else (e.g. a tunnel hostname): DEV_ALLOWED_ORIGINS=my-tunnel.example.com
    ...(process.env.DEV_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ],
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
