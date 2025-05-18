import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	experimental: {
		// Externalize @ucanto packages that might involve WASM or complex bundling for Server Actions
		serverComponentsExternalPackages: [
			"@ucanto/principal",
			"@ucanto/signer", // Used by w3up-client for ed25519
			"@ipld/car", // Handles CAR file format, might have WASM or be complex
		],
	},
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
			layers: true, // Often recommended for WASM with Next.js
		};

		// Specify output for WASM files
		// Ensures they are correctly placed and accessible in the Vercel environment
		config.output.webassemblyModuleFilename = isServer
			? "../static/wasm/[modulehash].wasm" // For server-side, relative to .next/server/
			: "static/wasm/[modulehash].wasm"; // For client-side

		// Ensure rule for .wasm files is correctly set up for server and client
		config.module.rules.push({
			test: /\.wasm$/,
			type: "webassembly/async",
		});

		return config;
	},
};

export default nextConfig;
