"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "./header";
import PixelGrid from "./pixel-grid";
import PurchasePanel from "./purchase-panel";
import { useCurrentFlowUser } from "@onflow/kit";
import { PixelData, CanvasOverview } from "@/lib/pixel-types";
import { useCanvasOverview, useCanvasSectionData } from "@/lib/pixel-hooks";

// Define CanvasSectionParams interface if not already imported from pixel-hooks
// (Assuming it's not exported from pixel-hooks.ts, so defining locally or importing if it is)
interface CanvasSectionParams {
	startX: number;
	startY: number;
	width: number;
	height: number;
}

const DEFAULT_GRID_SIZE = 20;

export default function AIPixelCanvas() {
	const [selectedSpace, setSelectedSpace] = useState<PixelData | null>(null);
	const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);

	const {
		data: canvasOverview,
		isLoading: isOverviewLoading,
		error: overviewError,
		refetch: fetchCanvasOverview,
	} = useCanvasOverview();

	// State for grid parameters, passed to useCanvasSectionData
	const [gridParams, setGridParams] = useState<CanvasSectionParams | null>(
		null
	);

	useEffect(() => {
		// Initialize gridParams or update them when gridSize changes
		setGridParams({
			startX: 0,
			startY: 0,
			width: gridSize,
			height: gridSize,
		});
	}, [gridSize]);

	const {
		data: pixelsData,
		isLoading: isSectionLoading,
		error: sectionError,
		refetch: refetchPixelData,
	} = useCanvasSectionData(gridParams);

	useEffect(() => {
		if (gridParams) {
			refetchPixelData();
		}
	}, [gridParams, refetchPixelData]);

	const handlePurchaseSuccess = useCallback(async () => {
		console.log("Purchase successful, refreshing canvas data...");
		setSelectedSpace(null);
		await fetchCanvasOverview();
		if (gridParams) {
			await refetchPixelData();
		}
	}, [fetchCanvasOverview, refetchPixelData, gridParams]);

	const fullGridPixels: PixelData[] = [];
	if (!isSectionLoading && !isOverviewLoading && pixelsData && gridParams) {
		for (let y = 0; y < gridParams.height; y++) {
			for (let x = 0; x < gridParams.width; x++) {
				const dbPixel = pixelsData.find((p) => p.x === x && p.y === y);
				if (dbPixel) {
					fullGridPixels.push(dbPixel);
				} else {
					fullGridPixels.push({
						id: -(y * gridParams.width + x + 1),
						x,
						y,
						isTaken: false,
						ownerId: null,
						nftId: null,
						imageURL: null,
						prompt: null,
						style: null,
						price: null,
						isListed: false,
						listingId: null,
					});
				}
			}
		}
	}

	type PixelGridCell = {
		id: number;
		x: number;
		y: number;
		owner: string | null;
		image: string | null;
		originalPixelData: PixelData;
	};

	const transformedGridData: PixelGridCell[] = fullGridPixels.map((p) => ({
		id: p.id!,
		x: p.x,
		y: p.y,
		owner: p.ownerId || null,
		image: p.imageURL || null,
		originalPixelData: p,
	}));

	const handleCellClick = (cell: PixelGridCell) => {
		const originalPixel = cell.originalPixelData;
		if (!originalPixel.isTaken) {
			setSelectedSpace(originalPixel);
		} else {
			setSelectedSpace(originalPixel);
			console.log("Selected owned pixel:", originalPixel);
		}
	};

	if (sectionError || overviewError) {
		return (
			<div className="flex justify-center items-center h-screen">
				Error loading canvas: {sectionError?.message || overviewError?.message}
			</div>
		);
	}

	if (isOverviewLoading || isSectionLoading) {
		return (
			<div className="flex justify-center items-center h-screen">
				Loading canvas data...
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen">
			<main className="flex flex-1 overflow-hidden">
				<PixelGrid
					gridSize={gridSize}
					gridData={transformedGridData}
					onCellClick={handleCellClick}
					soldPercentage={
						canvasOverview
							? canvasOverview.soldPixels / canvasOverview.totalPixels
							: 0
					}
					currentPrice={canvasOverview ? canvasOverview.currentPrice : 10}
				/>

				<div className="w-96 bg-gray-50 dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
					<PurchasePanel
						selectedSpace={
							selectedSpace
								? {
										id: selectedSpace.id!,
										x: selectedSpace.x,
										y: selectedSpace.y,
										owner: selectedSpace.ownerId || null,
										image: selectedSpace.imageURL || null,
								  }
								: null
						}
						currentPrice={canvasOverview ? canvasOverview.currentPrice : 10}
						onCancel={() => setSelectedSpace(null)}
						onPixelPurchased={handlePurchaseSuccess}
						onPurchaseSuccess={handlePurchaseSuccess}
					/>
				</div>
			</main>
		</div>
	);
}
