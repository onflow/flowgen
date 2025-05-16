import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	webpack: (config, { isServer }) => {
		config.module.rules.push({
			test: /\.cdc$/,
			use: "raw-loader",
		});
		return config;
	},
};

export default nextConfig;
