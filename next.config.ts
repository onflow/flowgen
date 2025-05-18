import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */

	// Use the top-level serverExternalPackages
	serverExternalPackages: ["@ucanto/principal", "@ucanto/signer", "@ipld/car"],

	webpack: (config, { isServer }) => {
		config.module.rules.push({
			test: /\.cdc$/,
			use: "raw-loader",
		});
		config.externals.push("pino-pretty", "lokijs", "encoding");

		// Keep asyncWebAssembly enabled, as Next.js might still need this globally
		config.experiments = {
			...config.experiments,
			asyncWebAssembly: true,
			layers: true,
		};

		// NO explicit .wasm rule or output.webassemblyModuleFilename
		// if the above packages are truly external and handle their own WASM.

		return config;
	},
};

export default nextConfig;
