import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this Turbopack walks up and finds an unrelated
  // lockfile in the home directory.
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
