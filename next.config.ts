import type { NextConfig } from "next";

const isStaticExport = process.env.BUILD_MODE === "static";

const nextConfig: NextConfig = {
  // Tauri 桌面端使用纯静态导出；服务器部署保持 standalone。
  output: isStaticExport ? "export" : "standalone",
  // 静态导出时禁用图片优化（无 Node 服务器处理 /_next/image）。
  images: isStaticExport ? { unoptimized: true } : undefined,
  outputFileTracingRoot: process.cwd(),
  env: {
    // Client-safe envs only. Do NOT expose secrets here.
    API_URL: process.env.API_URL,
  },
};

export default nextConfig;
