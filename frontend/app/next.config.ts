import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Pin the workspace root. Without it Turbopack walks up past the repo and
  // finds an unrelated lockfile in the home directory.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },

  images: {
    // YouTube poster frames are the only remote images the site uses.
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
    ],
    // Sized for the breakpoints the mobile-first brief calls out.
    deviceSizes: [320, 375, 430, 640, 768, 1024, 1280, 1536],
    imageSizes: [96, 128, 180, 256, 384],
    formats: ["image/avif", "image/webp"],
  },

  experimental: {
    // Keeps the client bundle from pulling the whole icon set.
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
  },
};

export default nextConfig;
