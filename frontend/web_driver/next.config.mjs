/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app is deployed as a static site (S3 website bucket).
  // `next build` will emit an `out/` directory.
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
