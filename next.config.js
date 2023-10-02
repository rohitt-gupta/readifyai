const { isServer } = require("@tanstack/react-query");

/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		domains: ["lh3.googleusercontent.com"], // Add the lh3.googleusercontent.com domain here
	},
	async redirects() {
		return [
			{
				source: "/sign-in",
				destination: "/api/auth/login",
				permanent: true,
			},
			{
				source: "/sign-up",
				destination: "/api/auth/register",
				permanent: true,
			},
		];
	},

	webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
		config.resolve.alias.canvas = false;
		config.resolve.alias.encoding = false;
		return config;
	},
};

module.exports = nextConfig;
