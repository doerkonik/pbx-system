/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets a deploy build into a staging directory and swap it in atomically.
  // Building straight into `.next` deletes the chunks the running server is
  // still serving, so every request during the build fails with a client-side
  // exception. See deploy.sh.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
