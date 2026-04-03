import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduces "Invalid source map" warnings from dependencies
  productionBrowserSourceMaps: false,
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon.png" }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "rjtattoostudio.com",
      },
    ],
  },
};

export default nextConfig;
