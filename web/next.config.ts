import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No need to advertise the framework in response headers.
  poweredByHeader: false,
};

export default nextConfig;
