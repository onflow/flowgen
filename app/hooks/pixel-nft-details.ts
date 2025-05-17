import { useFlowQuery } from "@onflow/kit";
import GET_PIXEL_NFT_DETAILS_SCRIPT from "@/cadence/scripts/GetPixelNFTDetails.cdc"; // Assuming raw import setup for .cdc files

// This should match the structure returned by the Cadence script
// We might need to adjust field names if they are different after FCL decoding (e.g. camelCase vs snake_case)
// For now, assuming they match the Cadence struct field names.
export interface PixelNFTDetails {
	id: string; // Typically UInt64 becomes string or number after FCL
	name: string;
	description: string;
	thumbnailURL: string;
	aiPrompt: string;
	imageURI: string;
	pixelArtURI: string;
	imageHash: string;
	x: number; // Typically UInt16 becomes number
	y: number; // Typically UInt16 becomes number
	displayView?: {
		// This is an optional nested struct from MetadataViews.Display
		name: string;
		description: string;
		thumbnail: {
			// This is MetadataViews.HTTPFile
			url: string;
		};
	};
}

interface UsePixelNftDetailsProps {
	ownerAddress: string; // Made mandatory for the hook to run
	nftId: string | number; // Made mandatory for the hook to run
	// enabled prop removed from here as it's not used by the hook directly if useFlowQuery doesn't support it
}

interface UsePixelNftDetailsResult {
	data: PixelNFTDetails | null;
	isLoading: boolean;
	error: Error | null;
}

export function usePixelNftDetails({
	ownerAddress,
	nftId,
}: UsePixelNftDetailsProps): UsePixelNftDetailsResult {
	const {
		data: rawData,
		isLoading,
		error,
	} = useFlowQuery({
		cadence: GET_PIXEL_NFT_DETAILS_SCRIPT,
		args: (arg, t) => [
			arg(ownerAddress, t.Address), // Now directly using, assuming they are provided
			arg(String(nftId), t.UInt64),
		],
		// 'enabled' option removed from here
	});

	// Perform casting after the data is returned
	const data = rawData as PixelNFTDetails | null;

	return {
		data,
		isLoading,
		error: error as Error | null,
	};
}
