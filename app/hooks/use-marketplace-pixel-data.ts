import { useState, useEffect } from "react";
import { PixelData } from "@/lib/pixel-types";
import { useFlowQuery } from "@onflow/kit";
import * as fcl from "@onflow/fcl";
import GET_PIXEL_WITH_LISTING_INFO_CDC from "@/cadence/scripts/GetPixelWithListingInfo.cdc";

// Hook to get pixel data with marketplace info
export function useMarketplacePixelData(x: number | null, y: number | null) {
  const [pixelData, setPixelData] = useState<PixelData | null>(null);

  const { data, isLoading, error, refetch } = useFlowQuery({
    query: {
      enabled: x !== null && y !== null,
    },
    queryKey: ["marketplacePixelData", x, y],
    queryFn: async () => {
      if (x === null || y === null) return null;
      
      const result = await fcl.query({
        cadence: GET_PIXEL_WITH_LISTING_INFO_CDC,
        args: (arg: any, t: any) => [
          arg(x.toString(), t.UInt16),
          arg(y.toString(), t.UInt16),
        ],
      });
      
      return result;
    },
  });

  useEffect(() => {
    if (data && x !== null && y !== null) {
      const pixelInfo: PixelData = {
        x: x,
        y: y,
        isTaken: data.isTaken || false,
        nftId: data.nftId || null,
        isListed: data.isListed || false,
        price: data.listingPrice || data.primaryPrice || null,
        sellerAddress: data.sellerAddress || null,
        ownerId: data.ownerId || null,
        // These would come from your database
        ipfsImageCID: null,
        prompt: null,
        style: null,
      };
      
      setPixelData(pixelInfo);
    }
  }, [data, x, y]);

  return { pixelData, isLoading, error, refetch };
}

// Hook to enrich grid data with marketplace info
export function useEnrichedGridData(baseGridData: PixelData[]) {
  const [enrichedData, setEnrichedData] = useState<PixelData[]>(baseGridData);

  useEffect(() => {
    // In a real implementation, you would:
    // 1. Query all active listings from the blockchain
    // 2. Match them with the grid data
    // 3. Update the isListed, price, and sellerAddress fields
    
    // For now, we'll simulate some listings
    const simulatedListings = new Map<string, { price: number; seller: string }>();
    
    // Simulate a few listings (in production, get from blockchain)
    // simulatedListings.set("5,5", { price: 12.5, seller: "0x123..." });
    // simulatedListings.set("10,10", { price: 25.0, seller: "0x456..." });

    const enriched = baseGridData.map(pixel => {
      const key = `${pixel.x},${pixel.y}`;
      const listing = simulatedListings.get(key);
      
      if (listing && pixel.isTaken) {
        return {
          ...pixel,
          isListed: true,
          price: listing.price,
          sellerAddress: listing.seller,
        };
      }
      
      return pixel;
    });

    setEnrichedData(enriched);
  }, [baseGridData]);

  return enrichedData;
}