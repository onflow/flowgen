import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */

	// Use the top-level serverExternalPackages
	serverExternalPackages: [
		"@ucanto/principal",
		"@ucanto/signer", // Used by w3up-client for ed25519 via Signer.parse
		"@ipld/car", // Handles CAR file format
		// Potentially add other direct dependencies of @web3-storage/w3up-client if they seem problematic
		// For example, if 'multiformats' or parts of '@web3-storage/access' were causing issues.
	],

	webpack: (config, { isServer }) => {
		config.module.rules.push({
			test: /\.cdc$/,
			use: "raw-loader",
		});
		config.externals.push("pino-pretty", "lokijs", "encoding");

		// Configure Webpack for WebAssembly
		config.experiments = {
			...config.experiments,
			asyncWebAssembly: true, // Enable modern WASM support
			layers: true, // Often recommended for WASM with Next.js, check if needed/supported
		};

		// Specify output for WASM files
		config.output.webassemblyModuleFilename = isServer
			? "../static/wasm/[modulehash].wasm" // For server-side, relative to .next/server/
			: "static/wasm/[modulehash].wasm"; // For client-side

		// Ensure rule for .wasm files is correctly set up for server and client
		config.module.rules.push({
			test: /\.wasm$/,
			type: "webassembly/async", // Standard Webpack 5 type for async WASM
		});

		return config;
	},
};

export default nextConfig;
