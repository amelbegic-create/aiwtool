import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Keep server actions upload body size limit
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  // Images (Vercel Blob + placeholder)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
    ],
  },
};

export default nextConfig;
