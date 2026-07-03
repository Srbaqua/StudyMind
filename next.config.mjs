/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js", "umap-js", "density-clustering", "pdfjs-dist"],
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
