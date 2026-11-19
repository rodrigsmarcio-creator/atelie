import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // core e db são consumidos direto do código-fonte TypeScript (sem dist).
  transpilePackages: ['@atelie/core', '@atelie/db'],
};

export default nextConfig;
