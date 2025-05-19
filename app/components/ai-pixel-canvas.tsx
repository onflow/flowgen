"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "./header";
import { PixelGrid } from "./pixel-grid";
import { PurchasePanel } from "./purchase-panel";
import { useCurrentFlowUser } from "@onflow/kit";
import { PixelData, CanvasOverview, PixelOnChainData } from "@/lib/pixel-types";
import {
	useAllPixelData,
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

const DEFAULT_GRID_SIZE = 16; // 1024/64 = 16 cells

export default function AIPixelCanvas() {
	const [selectedSpace, setSelectedSpace] = useState<PixelOnChainData | null>(
		null
	);
	const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
	const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
	const [isUpdatingCanvas, setIsUpdatingCanvas] = useState(false);

	const {
		data: canvasOverview,
		isLoading: isOverviewLoading,
		error: overviewError,
		refetch: fetchCanvasOverview,
	} = useCanvasOverview();

	const {
		data: allPixelsData,
		isLoading: isAllPixelsLoading,
		error: allPixelsError,
		refetch: refetchAllPixels,
	} = useAllPixelData();

	// State for grid parameters, passed to useCanvasSectionData
	const [gridParams, setGridParams] = useState<CanvasSectionParams | null>(
		null
	);

	const fullGridPixels: PixelData[] = [];
	if (!isOverviewLoading && allPixelsData && gridParams) {
		for (let y = 0; y < gridParams.height; y++) {
			for (let x = 0; x < gridParams.width; x++) {
				const dbPixel = allPixelsData.find((p) => p.x === x && p.y === y);
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
						ipfsImageCID: null,
						imageMediaType: null,
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
			refetchAllPixels();
		}
	}, [gridParams, refetchPixelData, refetchAllPixels]);

	// Load canvas URL from localStorage on mount
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const savedCanvasUrl = localStorage.getItem('canvasUrl');
			if (savedCanvasUrl) {
				setCanvasUrl(savedCanvasUrl);
			}
		}
	}, []);

	const handlePurchaseSuccess = useCallback(async () => {
		console.log("Purchase successful, refreshing canvas data...");
		await fetchCanvasOverview();
		if (gridParams) {
			await refetchPixelData();
			await refetchAllPixels();
		}
	}, [fetchCanvasOverview, refetchPixelData, refetchAllPixels, gridParams]);

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

	const handleGeneratePixel = async (prompt: string, style: string) => {
		if (!selectedSpace) return;

		setIsUpdatingCanvas(true);

		try {
			const response = await fetch('/api/update-canvas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt,
					style,
					x: selectedSpace.x,
					y: selectedSpace.y,
					previousCanvasUrl: canvasUrl
				})
			});

			if (!response.ok) {
				throw new Error('Failed to update canvas');
			}

			const data = await response.json();
			console.log('Generated pixel:', data);

			// Update canvas URL with the new one from the response
			if (data.canvasUrl) {
				setCanvasUrl(data.canvasUrl);
				// Save to localStorage for persistence
				localStorage.setItem('canvasUrl', data.canvasUrl);
			}

			// Return the data so the Purchase panel can access it
			return data;
		} catch (error) {
			console.error('Error generating pixel:', error);
		} finally {
			setIsUpdatingCanvas(false);
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
		<div className="flex flex-col min-h-screen">
			<main className="flex-1 py-6">
				<div className="container mx-auto max-w-7xl relative">
					{/* Canvas background image */}
					{canvasUrl && (
						<div
							className="absolute inset-0 z-0"
							style={{
								backgroundImage: `url(${canvasUrl}?t=${Date.now()})`,
								backgroundSize: 'contain',
								backgroundRepeat: 'no-repeat',
								backgroundPosition: 'center',
								width: '1024px',
								height: '1024px',
								margin: '0 auto'
							}}
						/>
					)}

					{/* Grid overlay */}
					<PixelGrid
						gridSize={gridSize}
						gridData={fullGridPixels || []}
						onCellClick={handleCellClick}
						selectedSpace={selectedSpace}
						setSelectedSpace={setSelectedSpace}
						soldPercentage={
							canvasOverview
								? (canvasOverview.soldPixels / canvasOverview.totalPixels) * 100
								: 0
						}
						currentPrice={canvasOverview ? canvasOverview.currentPrice : 10}
						backgroundUrl={canvasUrl}
					/>

					<div className="w-96 bg-gray-50 dark:bg-gray-800 p-6 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
						<PurchasePanel
							selectedSpace={selectedSpace}
							currentPrice={canvasOverview ? canvasOverview.currentPrice : 10}
							onCancel={() => setSelectedSpace(null)}
							onPurchaseSuccess={handlePurchaseSuccess}
							onGenerate={handleGeneratePixel}
							isUpdatingCanvas={isUpdatingCanvas}
							canvasUrl={canvasUrl}
						/>
					</div>
				</div>
			</main>
		</div>
	);
}
