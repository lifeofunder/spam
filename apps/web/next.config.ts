import type { NextConfig } from 'next';

const staticExport = process.env.NEXT_STATIC_EXPORT === '1';

/**
 * On GitHub Actions, `NEXT_PUBLIC_BASE_PATH` is often unset (repo Variables empty),
 * which produces `/_next/...` in HTML. Project Pages are served from `/<repo>/`, so
 * assets 404 at `https://user.github.io/_next/...` and the site looks unstyled / broken.
 * We infer `/repo` from `GITHUB_REPOSITORY` when appropriate.
 */
function inferBasePathFromGithubActions(): string {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return '';
  }
  const full = process.env.GITHUB_REPOSITORY;
  if (!full?.includes('/')) {
    return '';
  }
  const repo = full.split('/')[1];
  if (!repo) {
    return '';
  }
  // User/org Pages site (repo named `<owner>.github.io`) is served from site root — no basePath.
  if (/\.github\.io$/i.test(repo)) {
    return '';
  }
  return `/${repo}`;
}

const explicitBase = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';
const basePathRaw = (explicitBase !== '' ? explicitBase : inferBasePathFromGithubActions()).replace(
  /\/$/,
  '',
);

const nextConfig: NextConfig = {
  ...(staticExport ? { output: 'export' as const } : {}),
  /** Project Pages (`/repo/`) need the same prefix for `/_next/static` (see README). */
  ...(basePathRaw ? { basePath: basePathRaw, assetPrefix: basePathRaw } : {}),
  transpilePackages: ['@email-saas/shared'],
  ...(staticExport
    ? {
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
