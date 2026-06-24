/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The 3D viewer (Step 3) and Supabase Storage serve assets from external
  // origins; we allow the Supabase project domain for <Image> + fetch.
  // Tighten this once the production Supabase URL is known.
};

module.exports = nextConfig;
