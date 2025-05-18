import * as fcl from "@onflow/fcl";

const FLOW_ACCESS_NODE_URL = process.env.FLOW_ACCESS_NODE_URL;

if (!FLOW_ACCESS_NODE_URL) {
	console.warn(
		"FLOW_ACCESS_NODE_URL environment variable is not set. Server-side FCL may not connect to Flow."
	);
}

// Configure FCL for server-side use
// This will be automatically applied when this module is imported.
fcl.config({
	"accessNode.api": FLOW_ACCESS_NODE_URL || "http://localhost:8888", // Fallback for local dev if not set
	// Add other server-specific configurations if needed, e.g., service account for signing transactions
	// For just tracking transactions, an access node is sufficient.
});

// You can export fcl if you want to ensure it's the configured instance,
// though typically importing fcl directly in other server modules will use this config.
export { fcl };
