import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	webpack: (config, { isServer }) => {
		config.module.rules.push({
			test: /\.cdc$/,
			use: "raw-loader",
		});
		//		config.externals.push("pino-pretty", "lokijs", "encoding");

		return config;
	},
};

export default nextConfig;
