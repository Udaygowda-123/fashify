import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits over the hero and lands in every screenshot.
  devIndicators: false,

  images: {
    /**
     * The default ladder tops out at 3840px, but the largest photograph in
     * public/images is 2400px wide. Advertising widths above the source means
     * a wide or high-DPR screen asks the optimizer to upscale — real work for
     * no more detail. Capped at the actual source width instead.
     */
    deviceSizes: [420, 640, 828, 1080, 1400, 1920, 2400],
    imageSizes: [96, 160, 256, 384],
    formats: ["image/webp"],
  },
};

export default nextConfig;
