import type { NextConfig } from "next";

// Headless NodeNext modules use emitted .js specifiers. Resolve those to the
// original TypeScript when the web server imports the shared source modules.
const config: NextConfig = {
  experimental: { extensionAlias: { ".js":[".ts",".tsx",".js"] } },
};
export default config;
