import type { NextConfig } from "next";

const apiProxyTarget = process.env.NEXT_API_PROXY_TARGET?.replace(/\/$/, "");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self';",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms;",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
      "img-src 'self' data: blob: i.ibb.co res.cloudinary.com api.qrserver.com flagcdn.com https://flagcdn.com https://*.cloudinary.com;",
      "font-src 'self' https://fonts.gstatic.com;",
      "frame-src 'self' https://challenges.cloudflare.com https://checkout.dlocalgo.com https://checkout-sbx.dlocalgo.com;",
      "connect-src 'self' ws: wss: https://www.apicountries.com https://www.clarity.ms https://*.clarity.ms https://www.google-analytics.com https://*.google-analytics.com https://api.cloudinary.com https://*.cloudinary.com https://api.dlocalgo.com https://checkout.dlocalgo.com https://api-sbx.dlocalgo.com https://checkout-sbx.dlocalgo.com https://*.vercel.app;",
      "upgrade-insecure-requests;"
    ].join(" ")
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()"
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  }
];

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    if (!apiProxyTarget) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
