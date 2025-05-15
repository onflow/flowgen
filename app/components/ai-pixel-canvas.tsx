"use client";

import React, { useState, useEffect } from "react";
import Header from "./header";
import PixelGrid from "./pixel-grid";
import PurchasePanel from "./purchase-panel";
import { useCurrentFlowUser } from "@onflow/kit";

export default function AIPixelCanvas() {
	const [selectedSpace, setSelectedSpace] = useState<any>(null);
	const [canvasState, setCanvasState] = useState<any>({
		soldPercentage: 0,
		currentPrice: 10, // Default starting price
	});

	const { user, authenticate, unauthenticate } = useCurrentFlowUser();

	// Fetch canvas state from blockchain when authenticated
	useEffect(() => {
		if (user.loggedIn) {
			// This would be a real script execution in production
			/*
			const { data, isLoading } = executeScript(
				`
				import FlowGenCanvas from 0xFlowGenCanvas

				pub fun main(): {String: AnyStruct} {
					let totalPixels = FlowGenCanvas.totalPixels
					let soldPixels = FlowGenCanvas.soldPixels
					let soldPercentage = UFix64(soldPixels) / UFix64(totalPixels)
					let currentPrice = FlowGenCanvas.getCurrentPrice()
					
					return {
						"totalPixels": totalPixels,
						"soldPixels": soldPixels,
						"soldPercentage": soldPercentage,
						"currentPrice": currentPrice,
						"canvasWidth": FlowGenCanvas.canvasWidth,
						"canvasHeight": FlowGenCanvas.canvasHeight
					    }
				}
				`
			);

			if (data && !isLoading) {
				setCanvasState({
					soldPercentage: data.soldPercentage,
					currentPrice: data.currentPrice,
					// Other state properties
				});
			}
			*/

			// Using mock data for demonstration
			const mockSoldPercentage = Math.random() * 0.5; // 0-50% sold
			const basePrice = 10;
			const mockCurrentPrice = basePrice + basePrice * 9 * mockSoldPercentage;

			setCanvasState({
				soldPercentage: mockSoldPercentage,
				currentPrice: mockCurrentPrice,
			});
		}
	}, [user.loggedIn]);

	// Mock data for the grid
	const gridSize = 20; // 20x20 grid for demonstration
	const gridData = Array(gridSize * gridSize)
		.fill(null)
		.map((_, i) => ({
			id: i,
			x: i % gridSize,
			y: Math.floor(i / gridSize),
			owner: Math.random() > 0.7 ? "Someone" : null,
			image:
				Math.random() > 0.7 ? `https://picsum.photos/seed/${i}/50/50` : null,
		}));

	const handleCellClick = (cell: any) => {
		if (!cell.owner) {
			setSelectedSpace(cell);
		}
	};

	return (
		<div className="flex flex-col h-screen">
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
					/>
				</div>
			</main>
		</div>
	);
}
