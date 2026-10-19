import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STUDENTMARKET_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  // UI tests build separately so the development website can keep running.
  distDir: process.env.STUDENTMARKET_E2E_BUILD === "1" ? ".next-e2e" : process.env.STUDENTMARKET_STANDALONE === "1" ? ".next-render" : ".next",
  ...(process.env.STUDENTMARKET_E2E_BUILD === "1" ? { typescript: { tsconfigPath: "tsconfig.e2e-build.json" } } : process.env.STUDENTMARKET_STANDALONE === "1" ? { typescript: { tsconfigPath: "tsconfig.production.json" } } : {}),
  serverExternalPackages: ["nodemailer"],
  allowedDevOrigins: ["marital-dominoes-balmy.ngrok-free.dev"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
