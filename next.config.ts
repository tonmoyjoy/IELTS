import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.68.104"],
  serverExternalPackages: ["mongodb-memory-server"],
};

export default nextConfig;
