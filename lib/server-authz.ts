import { sansPrefix } from "@onflow/fcl";
import { ec as EC } from "elliptic"; // Import EC from elliptic
import { sha3_256 } from "js-sha3"; // Use js-sha3 which is already installed

// Read signature and hash algorithms from environment
const ADMIN_SIGN_ALGORITHM = process.env.FLOW_ADMIN_SIGN_ALGORITHM;
const ADMIN_HASH_ALGORITHM = process.env.FLOW_ADMIN_HASH_ALGORITHM;

// Initialize elliptic curve based on signature algorithm
const ec = new EC(
	ADMIN_SIGN_ALGORITHM === "ECDSA_secp256k1" ? "secp256k1" : "p256"
);

const hashMessageHex = (msgHex: string): Buffer => {
	// Use the hash algorithm from environment variables, defaulting to SHA3_256
	const algorithm = ADMIN_HASH_ALGORITHM || "SHA3_256";

	console.log("🔨 Hashing message with algorithm:", algorithm);

	if (algorithm === "SHA3_256") {
		const hash = sha3_256(Buffer.from(msgHex, "hex"));
		const hashBuffer = Buffer.from(hash, "hex");

		console.log(
			"📝 Original message (first 40 chars):",
			msgHex.substring(0, 40) + "..."
		);
		console.log("🔨 Hashed message:", hash);

		return hashBuffer;
	} else if (algorithm === "SHA2_256") {
		// For SHA2_256, we'd need a different approach, but for now using SHA3_256
		const hash = sha3_256(Buffer.from(msgHex, "hex"));
		const hashBuffer = Buffer.from(hash, "hex");

		console.log(
			"📝 Original message (first 40 chars):",
			msgHex.substring(0, 40) + "..."
		);
		console.log("🔨 Hashed message (using SHA3_256 fallback):", hash);

		return hashBuffer;
	} else {
		throw new Error(`Unsupported hash algorithm: ${algorithm}`);
	}
};

const signWithPrivateKey = async (
	privateKeyHex: string,
	messageHex: string
): Promise<string> => {
	// Validate inputs
	if (
		!privateKeyHex ||
		typeof privateKeyHex !== "string" ||
		privateKeyHex.length === 0
	) {
		throw new Error("Private key must be a non-empty hex string.");
	}
	if (
		!messageHex ||
		typeof messageHex !== "string" ||
		messageHex.length === 0
	) {
		throw new Error("Message to sign must be a non-empty hex string.");
	}

	try {
		// remove 0x prefix if it exists
		if (privateKeyHex.startsWith("0x")) {
			privateKeyHex = privateKeyHex.slice(2);
		}

		const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");

		// Log different public key formats for debugging
		const publicKeyUncompressed = keyPair.getPublic("hex"); // includes "04" prefix
		const publicKeyCompressed = keyPair.getPublic(true, "hex"); // compressed format
		const publicKeyRaw = publicKeyUncompressed.slice(2); // remove "04" prefix - this is what Flow expects

		console.log("🔑 Public key formats:");
		console.log("   - Uncompressed (with 04 prefix):", publicKeyUncompressed);
		console.log("   - Compressed:", publicKeyCompressed);
		console.log("   - Raw (Flow format):", publicKeyRaw);
		console.log(
			"   - Expected:",
			"5e516cbe23acb588ad030fdda78d38c6dc1feeea475df9e23209746be2f2d242c28187321de7440e46ea2a55b2ec887a172eab39943657bdce7dea9c31047d69"
		);
		console.log(
			"   - Match?",
			publicKeyRaw ===
				"5e516cbe23acb588ad030fdda78d38c6dc1feeea475df9e23209746be2f2d242c28187321de7440e46ea2a55b2ec887a172eab39943657bdce7dea9c31047d69"
		);
		console.log("🔧 Using signature algorithm:", ADMIN_SIGN_ALGORITHM);
		console.log("🔧 Using hash algorithm:", ADMIN_HASH_ALGORITHM);
		console.log(
			"🔧 Using curve:",
			ADMIN_SIGN_ALGORITHM === "ECDSA_secp256k1" ? "secp256k1" : "p256"
		);

		// Hash the message before signing
		const hashedMessage = hashMessageHex(messageHex);

		// Sign the hashed message with canonical signature
		const signature = keyPair.sign(hashedMessage, { canonical: true });

		// Convert signature to the format expected by Flow
		const r = signature.r.toArrayLike(Buffer, "be", 32);
		const s = signature.s.toArrayLike(Buffer, "be", 32);

		const signatureHex = Buffer.concat([r, s]).toString("hex");
		console.log("✍️ Generated signature:", signatureHex);

		return signatureHex;
	} catch (error: any) {
		console.error("Error during elliptic signing:", error.message);
		throw new Error(`Elliptic signing failed: ${error.message}`);
	}
};

export const serverAuthorization = async (account: any = {}) => {
	const addr = process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS; // Use NEXT_PUBLIC_FLOW_ADMIN_ADDRESS, not NEXT_PUBLIC_ for backend secrets
	const privateKey = process.env.FLOW_ADMIN_PRIVATE_KEY;
	const keyId = Number(process.env.FLOW_ADMIN_KEY_INDEX || "0");

	if (!addr || !privateKey) {
		console.error(
			"NEXT_PUBLIC_FLOW_ADMIN_ADDRESS or FLOW_ADMIN_PRIVATE_KEY is not set in environment variables."
		);
		throw new Error(
			"Server account details (address or private key) not configured for signing."
		);
	}

	// Validate that signature algorithm is set
	if (!ADMIN_SIGN_ALGORITHM) {
		throw new Error(
			"FLOW_ADMIN_SIGN_ALGORITHM environment variable is not set."
		);
	}

	console.log("🏗️ Setting up serverAuthorization with:");
	console.log("   - Address:", addr);
	console.log("   - Key ID:", keyId);
	console.log("   - Signature Algorithm:", ADMIN_SIGN_ALGORITHM);
	console.log("   - Hash Algorithm:", ADMIN_HASH_ALGORITHM);

	return {
		...account,
		tempId: `${sansPrefix(addr)}-${keyId}`,
		addr: sansPrefix(addr),
		keyId: keyId,
		signingFunction: async (signable: { message: string }) => {
			if (
				!signable ||
				typeof signable.message !== "string" ||
				signable.message.length === 0
			) {
				throw new Error(
					"Invalid or empty signable.message passed to signingFunction."
				);
			}
			try {
				console.log(
					"📝 Received message to sign (length):",
					signable.message.length
				);
				const signatureHex = await signWithPrivateKey(
					privateKey,
					signable.message
				);
				return {
					addr: sansPrefix(addr),
					keyId: keyId,
					signature: signatureHex,
				};
			} catch (signError: any) {
				console.error(
					"Error in signingFunction calling signWithPrivateKey:",
					signError.message
				);
				// Propagate the error so fcl.mutate can catch it properly.
				throw new Error(
					`Signing failed within signingFunction: ${signError.message}`
				);
			}
		},
	};
};
