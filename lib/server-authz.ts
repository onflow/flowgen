import { sansPrefix } from "@onflow/fcl";
import { ec as EC } from "elliptic"; // Import EC from elliptic
// import { sha3_256 } from "js-sha3"; // SHA3-256 hashing is usually handled by FCL/SDK before this point for signable.message

// Initialize P-256 curve instance (secp256r1)
const ADMIN_SIGN_ALGORITHM = process.env.FLOW_ADMIN_SIGN_ALGORITHM;
const ADMIN_SIGN_HASH_ALGORITHM = process.env.FLOW_ADMIN_SIGN_HASH_ALGORITHM;

const ec = new EC(
	ADMIN_SIGN_ALGORITHM === "ECDSA_secp256k1" ? "secp256k1" : "p256"
);

const signWithPrivateKey = async (
	privateKeyHex: string,
	messageHex: string
): Promise<string> => {
	// Validate inputs (basic)
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
		const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");

		// The messageHex from FCL is typically the domain-tagged hash or the message to be signed directly.
		// We do not hash it again here with SHA3 for Flow transaction signing via FCL.
		const signature = keyPair.sign(messageHex, { canonical: true });

		const r = signature.r.toArrayLike(Buffer, "be", 32);
		const s = signature.s.toArrayLike(Buffer, "be", 32);

		return Buffer.concat([r, s]).toString("hex");
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
