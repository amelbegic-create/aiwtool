import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdf-parse koristi Node native modul u server actions
  serverExternalPackages: ["pdf-parse"],
  // Ensures Vercel picks up latest commit (redeploy trigger)

  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Keep server actions upload body size limit
  experimental: {
    serverActions: {
      // Up to 100 images x 5 MB = 500 MB (+ overhead)
      bodySizeLimit: "600mb",
    },
  },

  // Images (Vercel Blob – profilni avatari + pravila; placeholder)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "ofcdur2g3ar3payo.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
    ],
  },
};

export default nextConfig;
