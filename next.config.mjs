/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.aliyuncs.com' },
    ],
  },
  // ws 依赖原生可选模块 bufferutil/utf-8-validate，必须在 server runtime 动态 require，
  // 否则 Next.js bundle 后会出现 `bufferUtil.mask is not a function`。
  serverExternalPackages: ['ws'],
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
