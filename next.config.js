/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // 支持 src 目录
  srcDir: 'src/',
  // 支持 presentation/pages 作为页面目录
  pageExtensions: ['ts', 'tsx'],
}

module.exports = nextConfig
