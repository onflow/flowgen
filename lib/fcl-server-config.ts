import * as fcl from "@onflow/fcl";
import { serverAuthorization } from "./server-authz"; // Import server authorization

const NEXT_PUBLIC_FLOW_ENDPOINT_URL = process.env.NEXT_PUBLIC_FLOW_ENDPOINT_URL;
const NEXT_PUBLIC_FLOW_NETWORK =
	process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator";
const NEXT_PUBLIC_FLOW_ADMIN_ADDRESS =
	process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS;

if (!NEXT_PUBLIC_FLOW_ENDPOINT_URL) {
	console.warn(
		"NEXT_PUBLIC_FLOW_ENDPOINT_URL environment variable is not set. Server-side FCL may not connect to Flow properly."
	);
}
if (
	!NEXT_PUBLIC_FLOW_ADMIN_ADDRESS &&
	NEXT_PUBLIC_FLOW_NETWORK !== "emulator"
) {
	// Emulator might not always need it if tx are simple scripts
	console.warn(
		"NEXT_PUBLIC_FLOW_ADMIN_ADDRESS environment variable is not set. Server-side transactions cannot be signed."
	);
}

// Base FCL configuration
fcl.config({
	"app.detail.title": "FlowGen Backend", // You can customize this
	"app.detail.icon": "https://flowgen.art/favicon.ico", // Replace with your app's icon
	"accessNode.api":
		NEXT_PUBLIC_FLOW_ENDPOINT_URL ||
		(NEXT_PUBLIC_FLOW_NETWORK === "emulator"
			? "http://localhost:8888"
			: NEXT_PUBLIC_FLOW_NETWORK === "testnet"
			? "https://rest-testnet.onflow.org"
			: "https://rest-mainnet.onflow.org"),
	"flow.network": NEXT_PUBLIC_FLOW_NETWORK,
});

// Discovery settings based on network (primarily for client-side, but good to have consistent config)
if (NEXT_PUBLIC_FLOW_NETWORK === "emulator") {
	fcl
		.config()
		.put(
			"discovery.wallet",
			process.env.NEXT_PUBLIC_FLOW_DISCOVERY_WALLET ||
				"http://localhost:8701/fcl/authn"
		);
} else if (NEXT_PUBLIC_FLOW_NETWORK === "testnet") {
	fcl
		.config()
		.put(
			"discovery.wallet",
			process.env.NEXT_PUBLIC_FLOW_DISCOVERY_WALLET ||
				"https://fcl-discovery.onflow.org/testnet/authn"
		);
} else if (NEXT_PUBLIC_FLOW_NETWORK === "mainnet") {
	fcl
		.config()
		.put(
			"discovery.wallet",
			process.env.NEXT_PUBLIC_FLOW_DISCOVERY_WALLET ||
				"https://fcl-discovery.onflow.org/authn"
		);
}
const isServerSide = typeof window === "undefined";

// Server-Side Authorization Configuration
if (isServerSide) {
	if (NEXT_PUBLIC_FLOW_ADMIN_ADDRESS && process.env.FLOW_ADMIN_PRIVATE_KEY) {
		// Check for private key too
		// Configure FCL to use serverAuthorization for the admin account
		// This tells FCL that for any transaction where NEXT_PUBLIC_FLOW_ADMIN_ADDRESS is the proposer/payer/authorizer,
		// it should use serverAuthorization.
		// Note: fcl.authz is an alias for fcl.authorizations, some examples use one or the other.
		// fcl.config().put("fcl.authz", [serverAuthorization]); // This might be too broad or old syntax

		// For modern FCL, setting proposer, payer, and a specific account authorization is more robust.
		// Ensure fcl.currentUser().authorization is not what we want for server-side, that's for client user sessions.

		// The roles (proposer, payer, authorizer) for a server-signed transaction
		// will be resolved using the serverAuthorization function itself.
		// FCL needs to know that such a function exists to provide these roles when needed.

		// Option 1: Make serverAuthorization the default for these roles
		fcl.config().put("fcl.proposer", serverAuthorization);
		fcl.config().put("fcl.payer", serverAuthorization);
		// And provide it as a general authorization function FCL can use
		// when it needs to authorize for the NEXT_PUBLIC_FLOW_ADMIN_ADDRESS
		fcl.config().put("fcl.authorizations", [serverAuthorization]);

		// Option 2 (More specific to an account, might be cleaner if you have multiple server accounts):
		// const addr = fcl.sansPrefix(NEXT_PUBLIC_FLOW_ADMIN_ADDRESS);
		// fcl.config().put(`fcl.account.${addr}.resolve`, serverAuthorization); // This tells FCL how to resolve the account roles to use this signer
		// This is more about resolving account details and services, less about directly providing the authz function for fcl.mutate internal logic.
		// For fcl.mutate, providing a global proposer/payer/authorizations that can satisfy the signing request is key.

		console.log(
			`Server-side FCL configured to use admin account ${NEXT_PUBLIC_FLOW_ADMIN_ADDRESS} for signing transactions.`
		);
	} else {
		console.warn(
			"NEXT_PUBLIC_FLOW_ADMIN_ADDRESS or FLOW_ADMIN_PRIVATE_KEY is not set. Server-side transactions will not be signed."
		);
	}
}
export { fcl };
// If you need Cadence types (like t.String), you can export them from here too or import directly
// export * as t from "@onflow/types";
