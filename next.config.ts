import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/maplibre",
        destination: "/maplibre/index.html",
      },
      {
        source: "/maplibre/:id",
        destination: "/maplibre/index.html",
      },
    ];
  },
};

export default nextConfig;
