import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  //cacheComponents: true,
  async redirects() {
    return [
      {
        source: "/services/massage",
        destination: "/services/cleaning",
        permanent: true,
      },
      {
        source: "/blog/benefits-of-massage-at-home",
        destination: "/blog",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
