"use client";

import React, { useEffect, useState } from "react";
import MarketplacePixelGrid from "./marketplace-pixel-grid";
import MarketplacePurchasePanel from "./marketplace-purchase-panel";
import { PixelData } from "@/lib/pixel-types";
import { useCanvasOverview, useAllPixelData } from "../hooks/pixel-hooks";
import { useEnrichedGridData } from "../hooks/use-marketplace-pixel-data";
import { useCurrentBackgroundInfo } from "../hooks/pixel-hooks";

const GRID_SIZE = 16; // 16x16 grid

export default function MarketplaceCanvas() {
	const [selectedPixel, setSelectedPixel] = useState<PixelData | null>(null);

	// Fetch canvas overview
	const { data: canvasOverview, refetch: refetchOverview } =
		useCanvasOverview();

	// Fetch grid data from database (includes all pixel states)
	const {
		data: allPixelsData,
		isLoading: isAllPixelsLoading,
		refetch: refetchAllPixels,
	} = useAllPixelData();

	// Create a complete grid with all positions (16x16)
	const gridData = React.useMemo(() => {
		const completeGrid: PixelData[] = [];
		
		// Create a map of existing pixels for quick lookup
		const existingPixelsMap = new Map<string, PixelData>();
		if (allPixelsData) {
			allPixelsData.forEach(pixel => {
				if (pixel.x >= 0 && pixel.x < GRID_SIZE && pixel.y >= 0 && pixel.y < GRID_SIZE) {
					existingPixelsMap.set(`${pixel.x},${pixel.y}`, pixel);
				}
			});
		}
		
		// Fill the complete 16x16 grid
		for (let y = 0; y < GRID_SIZE; y++) {
			for (let x = 0; x < GRID_SIZE; x++) {
				const key = `${x},${y}`;
				const existingPixel = existingPixelsMap.get(key);
				
				if (existingPixel) {
					// Use existing pixel data
					completeGrid.push(existingPixel);
				} else {
					// Create empty pixel for available space
					completeGrid.push({
						id: 10000 + (y * GRID_SIZE + x), // Use large offset to avoid DB ID conflicts
						x,
						y,
						isTaken: false,
						ownerId: null,
						nftId: null,
						ipfsImageCID: null,
						isListed: false,
						price: null,
						sellerAddress: null,
					});
				}
			}
		}
		
		return completeGrid;
	}, [allPixelsData]);

	const isLoading = isAllPixelsLoading;

	// Get background info
	const { imageUrl: backgroundUrl } = useCurrentBackgroundInfo();

	// Enrich grid data with marketplace info
	const enrichedGridData = useEnrichedGridData(gridData || []);

	// Debug log grid data
	useEffect(() => {
		if (gridData && gridData.length > 0) {
			console.log("🔍 Grid data sample:", gridData.slice(0, 5));
		}
	}, [gridData]);

	const handleCellClick = (cell: PixelData) => {
		setSelectedPixel(cell);
	};

	const handlePurchaseSuccess = () => {
		console.log("Purchase successful, refreshing grid...");
		// Refetch data
		refetchAllPixels();
		refetchOverview();
		// Clear selection
		setSelectedPixel(null);
	};

	const handleCancel = () => {
		setSelectedPixel(null);
	};

	if (isLoading && !gridData) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600 dark:text-gray-400">Loading canvas...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-gray-50 dark:bg-gray-900">
			{/* Main Canvas Area */}
			<div className="flex-1 overflow-auto">
				<MarketplacePixelGrid
					gridSize={GRID_SIZE}
					gridData={enrichedGridData}
					onCellClick={handleCellClick}
					soldPercentage={
						((canvasOverview?.soldPixels || 0) /
							(canvasOverview?.totalPixels || 1)) *
						100
					}
					currentPrice={canvasOverview?.currentPrice || 0}
					selectedPixel={selectedPixel}
					backgroundImageUrl={backgroundUrl || undefined}
				/>
			</div>

			{/* Side Panel */}
			<div className="w-96 bg-white dark:bg-gray-800 shadow-lg p-6 overflow-y-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
						FlowGen Marketplace
					</h1>
					<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
						Buy and sell pixels with automatic 25% markup
					</p>
				</div>

				<MarketplacePurchasePanel
					selectedPixel={selectedPixel}
					onCancel={handleCancel}
					onPurchaseSuccess={handlePurchaseSuccess}
				/>
			</div>
		</div>
	);
}
