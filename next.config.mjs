function toAllowedOrigin(value) {
  if (!value) return null;

  try {
    const normalized = value.includes("://") ? value : `https://${value}`;
    return new URL(normalized).host;
  } catch {
    return null;
  }
}

const deploymentOrigins = [
  process.env.APP_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_URL
]
  .map(toAllowedOrigin)
  .filter(Boolean);

const allowedOrigins = Array.from(new Set(["localhost:3000", ...deploymentOrigins]));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com"
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  }
};

export default nextConfig;
