/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // Povećali smo limit na 50MB
    },
  },
  images: {
    domains: ['public.blob.vercel-storage.com'], // Dozvoli slike sa Bloba
  },
};

export default nextConfig;