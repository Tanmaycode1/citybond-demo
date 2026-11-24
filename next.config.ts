import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  skipTrailingSlashRedirect: true,
  // The optional renderer reads local swatches, never journal or Metacity media.
  // Keep those static assets outside its serverless bundle.
  outputFileTracingExcludes: {
    "/api/visualizer/render": ["public/blog/**/*", "public/metacity/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/studio-7c9e",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};
export default config;
