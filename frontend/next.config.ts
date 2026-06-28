import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
  remotePatterns: [
    { protocol: "https", hostname: "i.ibb.co" },
    { protocol: "https", hostname: "res.cloudinary.com" },
  ],
},
};

export default nextConfig;
