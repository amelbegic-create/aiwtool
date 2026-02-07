import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Ensures Vercel picks up latest commit (redeploy trigger)

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Keep server actions upload body size limit
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
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
