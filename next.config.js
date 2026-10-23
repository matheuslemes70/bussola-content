/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["app.bussolamedia.com.br"],
    },
  },
};

module.exports = nextConfig;
