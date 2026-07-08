import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent browser-only packages from being bundled for the server.
  // mermaid and dompurify access window/document at module evaluation time.
  serverExternalPackages: ["mermaid", "dompurify"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Standard hardening headers. Note: artifact previews use sandboxed
          // srcDoc iframes, which are NOT affected by X-Frame-Options (that
          // header controls who may embed THIS app).
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
