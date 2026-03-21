import type { NextConfig } from 'next';

const staticExport = process.env.NEXT_STATIC_EXPORT === '1';
const basePathRaw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';
/** No trailing slash; empty for user-site Pages (`user.github.io`). */
const basePath = basePathRaw.replace(/\/$/, '');

const nextConfig: NextConfig = {
  ...(staticExport ? { output: 'export' as const } : {}),
  /** Project Pages (`/repo/`) need the same prefix for `/_next/static` (see README). */
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  transpilePackages: ['@email-saas/shared'],
  ...(staticExport
    ? {
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
