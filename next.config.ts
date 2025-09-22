/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint errors ko deploy ke waqt ignore karega
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
