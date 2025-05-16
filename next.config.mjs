/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack: (config, { isServer }) => {
		config.module.rules.push({
			test: /\.cdc$/,
			use: "raw-loader",
		});
		return config;
	},
	// experimental: {
	//   serverComponentsExternalPackages: ['@onflow/fcl', '@onflow/types'],
	// },
	// Ensure you have other configurations if they exist, for example:
	// reactStrictMode: true,
	// images: { domains: ['example.com'] },
};

export default nextConfig;
