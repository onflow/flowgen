"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "./header";
import PixelGrid from "./pixel-grid";
import PurchasePanel from "./purchase-panel";
import { useCurrentFlowUser } from "@onflow/kit";
import { PixelData, CanvasOverview, PixelOnChainData } from "@/lib/pixel-types";
import {
	useCanvasOverview,
	useCanvasSectionData,
} from "@/app/hooks/pixel-hooks";

// Define CanvasSectionParams interface if not already imported from pixel-hooks
// (Assuming it's not exported from pixel-hooks.ts, so defining locally or importing if it is)
interface CanvasSectionParams {
	startX: number;
	startY: number;
	width: number;
	height: number;
}

const DEFAULT_GRID_SIZE = 16;

export default function AIPixelCanvas() {
	const [selectedSpace, setSelectedSpace] = useState<PixelOnChainData | null>(
		null
	);
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

	type PixelGridCell = {
		id: number;
		x: number;
		y: number;
		isTaken: boolean;
		nftId: string | null;
		owner: string | null;
		image: string | null;
		originalPixelData: PixelData;
	};

	const handleCellClick = (cell: PixelOnChainData) => {
		const originalPixel = cell;
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
					gridData={pixelsData || []}
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
						selectedSpace={selectedSpace}
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
