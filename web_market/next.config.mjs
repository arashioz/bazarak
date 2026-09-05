const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  trailingSlash: true,
  output: "export",
  images: { unoptimized: true },
  ...(isGitHubPages ? { basePath: "/bazarak" } : {}),
};

export default nextConfig;
