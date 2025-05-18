import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	// We will not use serverExternalPackages for this attempt,
	// to let Webpack try to bundle and handle the problematic WASM.

	webpack: (config, { isServer, defaultLoaders }) => {
		config.module.rules.push({
			test: /\.cdc$/,
			use: "raw-loader",
		});
		config.externals.push("pino-pretty", "lokijs", "encoding");

		return config;
	},
};

export default nextConfig;
