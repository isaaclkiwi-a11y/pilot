export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const value = configured || 'https://pilot-school-platform.vercel.app';
  return value.replace(/\/+$/, '');
}
