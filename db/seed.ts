import { db } from "./index"; // Assuming your db instance is exported from db/index.ts
import { eventPollingStatus } from "./schema";
import { sql } from "drizzle-orm";

// --- Configuration (should match or be consistent with your cron job configs) ---
const NETWORKS = ["emulator", "testnet", "mainnet"] as const;
type Network = (typeof NETWORKS)[number];

const CONTRACT_ADDRESSES: Record<
	Network,
	Record<string, string | undefined>
> = {
	emulator: {
		CanvasBackground: "0xf8d6e0586b0a20c7",
		FlowGenPixel: "0xf8d6e0586b0a20c7", // Assuming same for emulator, adjust if different
		// Add other contract aliases here if needed
	},
	testnet: {
		CanvasBackground: process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS,
		FlowGenPixel: process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS, // Assuming same for testnet, adjust if different
	},
	mainnet: {
		CanvasBackground: process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS,
		FlowGenPixel: process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS,
	},
};

const STARTING_BLOCKS: Record<Network, number> = {
	emulator: 0,
	testnet: 259000,
	mainnet: 113000,
};

// --- Events to Seed ---
// Define the core event names (without contract address prefix)
const EVENTS_TO_SEED = [
	{ contractAlias: "CanvasBackground", eventNameSuffix: "NewBackgroundMinted" },
	{ contractAlias: "FlowGenPixel", eventNameSuffix: "PixelMinted" },
	{ contractAlias: "FlowGenPixel", eventNameSuffix: "PixelImageUpdated" },
];

async function seed() {
	console.log("Starting to seed event_polling_status table...");

	for (const network of NETWORKS) {
		const startingBlock = STARTING_BLOCKS[network];
		console.log(
			`\nProcessing network: ${network} (starting block: ${startingBlock})`
		);

		if (network === "mainnet") {
			if (!CONTRACT_ADDRESSES.mainnet.CanvasBackground) {
				console.warn(
					"Skipping mainnet CanvasBackground: NEXT_PUBLIC_FLOW_ADMIN_ADDRESS not set."
				);
			}
			if (!CONTRACT_ADDRESSES.mainnet.FlowGenPixel) {
				console.warn(
					"Skipping mainnet FlowGenPixel: NEXT_PUBLIC_FLOW_ADMIN_ADDRESS not set."
				);
			}
		}

		for (const eventDetail of EVENTS_TO_SEED) {
			const contractAddress =
				CONTRACT_ADDRESSES[network][eventDetail.contractAlias];

			if (!contractAddress) {
				console.warn(
					`  Skipping ${eventDetail.contractAlias}.${eventDetail.eventNameSuffix} for ${network}: Contract address not configured.`
				);
				continue;
			}

			const eventFQN = `A.${contractAddress}.${eventDetail.contractAlias}.${eventDetail.eventNameSuffix}`;

			try {
				await db
					.insert(eventPollingStatus)
					.values({
						eventName: eventFQN,
						lastPolledBlock: startingBlock,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.onConflictDoUpdate({
						// Use onConflictDoUpdate to set values if it exists, but only if you want to reset it. For seed, maybe doNothing is better if manually changed.
						target: eventPollingStatus.eventName,
						set: {
							// lastPolledBlock: startingBlock, // Uncomment if you want seed to OVERWRITE existing block height
							updatedAt: new Date(),
						},
					})
					// Alternative: .onConflictDoNothing() if you never want the seed to overwrite an existing value
					.execute();
				console.log(
					`  Successfully seeded/verified: ${eventFQN} with block ${startingBlock}`
				);
			} catch (error) {
				console.error(`  Error seeding ${eventFQN} for ${network}:`, error);
			}
		}
	}

	console.log("\nSeeding complete.");
}

seed().catch((error) => {
	console.error("Unhandled error during seeding:", error);
	process.exit(1);
});
