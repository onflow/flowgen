import { useState, useCallback } from "react";
import { useFlowMutate, useFlowQuery } from "@onflow/kit";
import * as fcl from "@onflow/fcl";

// Import Cadence scripts and transactions
import LIST_PIXEL_FOR_SALE_CDC from "@/cadence/transactions/ListPixelForSale.cdc";
import BUY_LISTED_PIXEL_CDC from "@/cadence/transactions/BuyListedPixel.cdc";
import DELIST_PIXEL_CDC from "@/cadence/transactions/DelistPixel.cdc";
import GET_PIXEL_LISTING_CDC from "@/cadence/scripts/GetPixelListing.cdc";
import GET_ALL_LISTINGS_FROM_SELLER_CDC from "@/cadence/scripts/GetAllListingsFromSeller.cdc";
import CHECK_PIXEL_LISTING_STATUS_CDC from "@/cadence/scripts/CheckPixelListingStatus.cdc";

// Combined purchase transaction
import PURCHASE_PIXEL_WITH_AUTO_RELIST_CDC from "@/cadence/transactions/PurchasePixelWithAutoRelist.cdc";

interface ListingInfo {
  pixelId: string;
  price: string;
  seller: string;
  x: number;
  y: number;
  originalPurchasePrice: string;
}

// Hook for listing a pixel for sale
export function useListPixelForSale() {
  const { mutate, isPending, error } = useFlowMutate({
    mutation: {
      onSuccess: (txId: string) => {
        console.log("Pixel listed successfully, transaction ID:", txId);
      },
    },
  });

  const listPixel = useCallback(
    async (pixelId: string, originalPurchasePrice: string) => {
      await mutate({
        cadence: LIST_PIXEL_FOR_SALE_CDC,
        args: (arg: any, t: any) => [
          arg(pixelId, t.UInt64),
          arg(originalPurchasePrice, t.UFix64),
        ],
      });
    },
    [mutate]
  );

  return { listPixel, isListing: isPending, error };
}

// Hook for buying a listed pixel
export function useBuyListedPixel() {
  const { mutate, isPending, error } = useFlowMutate({
    mutation: {
      onSuccess: (txId: string) => {
        console.log("Pixel purchased successfully, transaction ID:", txId);
      },
    },
  });

  const buyPixel = useCallback(
    async (sellerAddress: string, pixelId: string) => {
      await mutate({
        cadence: BUY_LISTED_PIXEL_CDC,
        args: (arg: any, t: any) => [
          arg(sellerAddress, t.Address),
          arg(pixelId, t.UInt64),
        ],
      });
    },
    [mutate]
  );

  return { buyPixel, isBuying: isPending, error };
}

// Hook for delisting a pixel
export function useDelistPixel() {
  const { mutate, isPending, error } = useFlowMutate({
    mutation: {
      onSuccess: (txId: string) => {
        console.log("Pixel delisted successfully, transaction ID:", txId);
      },
    },
  });

  const delistPixel = useCallback(
    async (pixelId: string) => {
      await mutate({
        cadence: DELIST_PIXEL_CDC,
        args: (arg: any, t: any) => [arg(pixelId, t.UInt64)],
      });
    },
    [mutate]
  );

  return { delistPixel, isDelisting: isPending, error };
}

// Hook for getting pixel listing info
export function usePixelListing(sellerAddress: string | null, pixelId: string | null) {
  const { data, isLoading, error, refetch } = useFlowQuery({
    query: {
      enabled: !!sellerAddress && !!pixelId,
    },
    queryKey: ["pixelListing", sellerAddress, pixelId],
    queryFn: async () => {
      if (!sellerAddress || !pixelId) return null;
      
      return await fcl.query({
        cadence: GET_PIXEL_LISTING_CDC,
        args: (arg: any, t: any) => [
          arg(sellerAddress, t.Address),
          arg(pixelId, t.UInt64),
        ],
      });
    },
  });

  return { listing: data as ListingInfo | null, isLoading, error, refetch };
}

// Hook for checking if a pixel is listed
export function useCheckPixelListingStatus(sellerAddress: string | null, pixelId: string | null) {
  const { data, isLoading, error, refetch } = useFlowQuery({
    query: {
      enabled: !!sellerAddress && !!pixelId,
    },
    queryKey: ["pixelListingStatus", sellerAddress, pixelId],
    queryFn: async () => {
      if (!sellerAddress || !pixelId) return { isListed: false, price: null };
      
      const result = await fcl.query({
        cadence: CHECK_PIXEL_LISTING_STATUS_CDC,
        args: (arg: any, t: any) => [
          arg(sellerAddress, t.Address),
          arg(pixelId, t.UInt64),
        ],
      });
      
      return {
        isListed: result[0],
        price: result[1],
      };
    },
  });

  return { 
    isListed: data?.isListed || false, 
    price: data?.price || null,
    isLoading, 
    error, 
    refetch 
  };
}

// Hook for combined purchase with auto-relist
export function usePurchasePixelWithAutoRelist({
  onSuccess,
  onError,
}: {
  onSuccess: (txId: string) => void;
  onError: (error: unknown) => void;
}) {
  const { mutate, isPending, error } = useFlowMutate({
    mutation: {
      onSuccess: (txId: string) => {
        console.log("Pixel purchase with auto-relist successful, transaction ID:", txId);
        onSuccess(txId);
      },
      onError: (error: unknown) => {
        console.error("Error in pixel purchase:", error);
        onError(error);
      },
    },
  });

  const purchasePixel = useCallback(
    async ({
      x,
      y,
      aiImageNftID,
      sellerAddress,
      autoRelist = true,
    }: {
      x: number;
      y: number;
      aiImageNftID: string;
      sellerAddress: string | null;
      autoRelist?: boolean;
    }) => {
      await mutate({
        cadence: PURCHASE_PIXEL_WITH_AUTO_RELIST_CDC,
        args: (arg: any, t: any) => [
          arg(x.toString(), t.UInt16),
          arg(y.toString(), t.UInt16),
          arg(aiImageNftID, t.UInt64),
          arg(sellerAddress, t.Optional(t.Address)),
          arg(autoRelist, t.Bool),
        ],
      });
    },
    [mutate]
  );

  return { purchasePixel, isPurchasing: isPending, error };
}

// Hook to get all listings from a seller
export function useSellerListings(sellerAddress: string | null) {
  const { data, isLoading, error, refetch } = useFlowQuery({
    query: {
      enabled: !!sellerAddress,
    },
    queryKey: ["sellerListings", sellerAddress],
    queryFn: async () => {
      if (!sellerAddress) return [];
      
      return await fcl.query({
        cadence: GET_ALL_LISTINGS_FROM_SELLER_CDC,
        args: (arg: any, t: any) => [arg(sellerAddress, t.Address)],
      });
    },
  });

  return { listings: (data as ListingInfo[]) || [], isLoading, error, refetch };
}