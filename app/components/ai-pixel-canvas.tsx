"use client";

import React, { useState, useEffect } from "react";
import Header from "./header";
import PixelGrid from "./pixel-grid";
import PurchasePanel from "./purchase-panel";
import { useCurrentFlowUser } from "@onflow/kit";
import { getPixels, getCurrentPrice, Pixel } from "../lib/canvas-db";

type CanvasState = {
	soldPercentage: number;
	currentPrice: number;
};

export default function AIPixelCanvas() {
	const [selectedSpace, setSelectedSpace] = useState<Pixel | null>(null);
	const [canvasState, setCanvasState] = useState<CanvasState>({
		soldPercentage: 0,
		currentPrice: 10,
	});
	const [gridData, setGridData] = useState<Pixel[]>([]);
	const gridSize = 20;

	const { user } = useCurrentFlowUser();

	// Initialize grid data from database
	useEffect(() => {
		async function loadCanvas() {
			try {
				let pixels = await fetch('/api/canvas').then(res => res.json());
				let price = await fetch('/api/canvas/price').then(res => res.json());

				// Create a full grid with empty pixels
				const fullGrid = Array(gridSize * gridSize).fill(null).map((_, i) => ({
					id: i,
					x: i % gridSize,
					y: Math.floor(i / gridSize),
					owner: null as string | null,
					image: null as string | null,
					price: 10,
					created_at: new Date()
				}));

				// Overlay stored pixels on the grid
				if (pixels && pixels.length > 0) {
					pixels.forEach((pixel: Pixel) => {
						const index = pixel.y * gridSize + pixel.x;
						if (index >= 0 && index < fullGrid.length) {
							fullGrid[index] = pixel;
						}
					});
				}

				const soldPixels = fullGrid.filter((p: Pixel) => p.owner !== null).length;

				setGridData(fullGrid);
				setCanvasState({
					soldPercentage: soldPixels / (gridSize * gridSize),
					currentPrice: price || 10
				});
			} catch (error) {
				console.error("Failed to load canvas:", error);
			}
		}
		loadCanvas();
	}, []);

	const handlePixelPurchased = async (newPixel: Pixel) => {
		try {
			const response = await fetch('/api/canvas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newPixel)
			});
			console.log("response", response, newPixel);

			if (response.ok) {
				setGridData(prevGrid =>
					prevGrid.map(pixel =>
						pixel.id === newPixel.id ? newPixel : pixel
					)
				);
				// Update canvas state
				const price = await fetch('/api/canvas/price').then(res => res.json());
				setCanvasState((prev: CanvasState) => ({
					...prev,
					soldPercentage: (gridData.length + 1) / (gridSize * gridSize),
					currentPrice: price
				}));
			}
		} catch (error) {
			console.error("Failed to purchase pixel:", error);
		}
	};

	const handleCellClick = (cell: Pixel) => {
		setSelectedSpace(cell);
	};

	return (
		<div className="flex flex-col h-screen">
			{/* Header */}
			<Header />

			{/* Main Content */}
			<main className="flex flex-1 overflow-hidden">
				{/* Canvas View */}
				<PixelGrid
					gridSize={gridSize}
					gridData={gridData}
					onCellClick={handleCellClick}
					soldPercentage={canvasState.soldPercentage}
					currentPrice={canvasState.currentPrice}
				/>

				{/* Sidebar - Purchase Panel */}
				<div className="w-96 bg-gray-50 p-6 border-l border-gray-200 overflow-y-auto">
					<PurchasePanel
						selectedSpace={selectedSpace}
						currentPrice={canvasState.currentPrice}
						onCancel={() => setSelectedSpace(null)}
						onPixelPurchased={handlePixelPurchased}
					/>
				</div>
			</main>
		</div>
	);
}
