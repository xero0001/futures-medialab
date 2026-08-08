import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@futures-medialab/ui", "@futures-medialab/database"],
};

export default nextConfig;
