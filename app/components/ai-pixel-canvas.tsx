"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "./header";
import PixelGrid from "./pixel-grid";
import PurchasePanel from "./purchase-panel";
import { useCurrentFlowUser } from "@onflow/kit";
import {
	getCanvasSectionDataServerAction,
	getCanvasOverviewServerAction,
} from "@/app/actions/canvas-actions";
import { PixelData, CanvasOverview } from "@/lib/pixel-types";

const DEFAULT_GRID_SIZE = 20;

export default function AIPixelCanvas() {
	const [selectedSpace, setSelectedSpace] = useState<PixelData | null>(null);
	const [canvasOverview, setCanvasOverview] = useState<CanvasOverview | null>(
		null
	);
	const [pixelsData, setPixelsData] = useState<PixelData[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);

	// const { user, authenticate, unauthenticate } = useCurrentFlowUser();

	const fetchCanvasOverview = useCallback(async () => {
		try {
			const overview = await getCanvasOverviewServerAction();
			setCanvasOverview(overview);
		} catch (err) {
			console.error("Failed to fetch canvas overview:", err);
		}
	}, []);

	const fetchPixelData = useCallback(
		async (startX: number, startY: number, width: number, height: number) => {
			setIsLoading(true);
			setError(null);
			try {
				const data = await getCanvasSectionDataServerAction({
					startX,
					startY,
					width,
					height,
				});
				setPixelsData(data);
			} catch (err) {
				console.error("Failed to fetch pixel data:", err);
				setError(
					err instanceof Error ? err.message : "An unknown error occurred"
				);
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	useEffect(() => {
		fetchCanvasOverview();
		fetchPixelData(0, 0, gridSize, gridSize);
	}, [fetchCanvasOverview, fetchPixelData, gridSize]);

	// Callback for when a purchase is successful
	const handlePurchaseSuccess = useCallback(async () => {
		console.log("Purchase successful, refreshing canvas data...");
		setSelectedSpace(null); // Clear selection
		setIsLoading(true); // Show loading indicator during refresh
		await fetchCanvasOverview();
		// fetchPixelData will set isLoading to false when done
		await fetchPixelData(0, 0, gridSize, gridSize);
	}, [fetchCanvasOverview, fetchPixelData, gridSize]); // Added gridSize to dependencies

	// Generate the full grid data, including placeholders for empty pixels
	const fullGridPixels: PixelData[] = [];
	if (!isLoading) {
		// Only generate once pixelData has been fetched (even if empty)
		for (let y = 0; y < gridSize; y++) {
			for (let x = 0; x < gridSize; x++) {
				const dbPixel = pixelsData.find((p) => p.x === x && p.y === y);
				if (dbPixel) {
					fullGridPixels.push(dbPixel);
				} else {
					// Create a placeholder for an empty/unsold pixel
					fullGridPixels.push({
						id: -(y * gridSize + x + 1), // Temporary negative ID for client-side placeholders
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

	// Define the type PixelGrid expects, if it's different from PixelData
	type PixelGridCell = {
		id: number; // Assuming PixelData.id is the DB primary key
		x: number;
		y: number;
		owner: string | null;
		image: string | null;
		// Include the original PixelData to easily access all its properties
		// and to set selectedSpace correctly.
		originalPixelData: PixelData;
	};

	const transformedGridData: PixelGridCell[] = fullGridPixels.map((p) => ({
		id: p.id!, // Assert id is present (will be negative for placeholders, positive for DB items)
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

	if (error) {
		return (
			<div className="flex justify-center items-center h-screen">
				Error loading canvas: {error}
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen">
			{/* Main Content */}
			<main className="flex flex-1 overflow-hidden">
				{/* Canvas View */}
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

				{/* Sidebar - Purchase Panel */}
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
