"use client";

import { useState, useEffect } from "react";
import { PurchasePanel } from "./purchase-panel";

interface PixelGridProps {
	gridSize: number;
	gridData?: any[];
	onCellClick?: (cell: any) => void;
	selectedSpace?: any;
	setSelectedSpace: (space: any) => void;
	soldPercentage?: number;
	currentPrice?: number;
	initialSoldPercentage?: number;
	initialPrice?: number;
	backgroundUrl?: string | null;
}

export function PixelGrid({
	gridSize = 32,
	gridData = [],
	onCellClick,
	selectedSpace = null,
	setSelectedSpace,
	soldPercentage,
	currentPrice,
	initialSoldPercentage = 0,
	initialPrice = 1.0,
	backgroundUrl
}: PixelGridProps) {
	const [localGridData, setLocalGridData] = useState<any[]>(gridData.length > 0 ? gridData : []);
	const [localSoldPercentage, setLocalSoldPercentage] = useState(soldPercentage || initialSoldPercentage);
	const [localCurrentPrice, setLocalCurrentPrice] = useState(currentPrice || initialPrice);
	const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
	const [isUpdatingCanvas, setIsUpdatingCanvas] = useState(false);

	// Load canvas URL from localStorage on mount
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const savedCanvasUrl = localStorage.getItem('canvasUrl');
			if (savedCanvasUrl) {
				setCanvasUrl(savedCanvasUrl);
			}
		}
	}, []);

	// Initialize grid data
	useEffect(() => {
		if (gridData.length === 0) {
			// Create a grid of cells
			const cells = Array.from({ length: gridSize * gridSize }, (_, index) => {
				const x = index % gridSize;
				const y = Math.floor(index / gridSize);
				return {
					id: `cell-${x}-${y}`,
					x,
					y,
					ownerId: null, // null means available
				};
			});

			setLocalGridData(cells);
		}
	}, [gridSize, gridData]);

	// Handle cell click
	const handleLocalCellClick = (cell: any) => {
		if (onCellClick) {
			onCellClick(cell);
		} else {
			if (cell.ownerId) {
				// Already owned
				return;
			}

			setSelectedSpace(cell);
		}
	};

	// Handle canvas update
	const updateCanvas = async (prompt: string, style: string) => {
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

			if (data.success) {
				const newCanvasUrl = data.canvasUrl;
				setCanvasUrl(newCanvasUrl);
				localStorage.setItem('canvasUrl', newCanvasUrl);

				// Mark the cell as owned
				setLocalGridData(prevGrid =>
					prevGrid.map(cell => {
						if (cell.x === selectedSpace.x && cell.y === selectedSpace.y) {
							return {
								...cell,
								ownerId: 'current-user' // Replace with actual user ID
							};
						}
						return cell;
					})
				);

				// Update sold percentage
				const newSoldPercentage = localSoldPercentage + (1 / (gridSize * gridSize));
				setLocalSoldPercentage(newSoldPercentage);

				// Increase price (example formula)
				const newPrice = initialPrice * (1 + (newSoldPercentage * 0.5));
				setLocalCurrentPrice(newPrice);
			}
		} catch (error) {
			console.error('Error updating canvas:', error);
		} finally {
			setIsUpdatingCanvas(false);
			setSelectedSpace(null);
		}
	};

	return (
		<div className="mx-auto" style={{ position: 'relative', width: '1024px', height: '1024px' }}>
			{/* If you want to show the background image here too */}
			{backgroundUrl && (
				<div
					className="absolute inset-0 z-0"
					style={{
						width: '100%',
						height: '100%',
						backgroundImage: `url(${backgroundUrl}?t=${Date.now()})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center'
					}}
				/>
			)}

			<div className="flex-1 p-4 overflow-auto flex flex-col items-center">
				<div className="mb-6 flex justify-center items-center w-full max-w-md">
					<div className="text-sm bg-blue-100 text-blue-800 p-2 rounded-lg">
						<span className="font-bold">
							{(localSoldPercentage * 100).toFixed(1)}%
						</span>{" "}
						sold • Current price:{" "}
						<span className="font-bold">{localCurrentPrice.toFixed(2)} FLOW</span> per
						cell
					</div>
				</div>

				<div className="text-sm text-gray-600 text-center mb-6">
					Click on any available white space to purchase
				</div>

				<div className="border border-gray-300 inline-block relative">
					{/* Canvas background */}
					{canvasUrl && (
						<div className="absolute inset-0">
							<img
								src={`${canvasUrl}?t=${Date.now()}`} // Add cache-busting
								alt="Canvas"
								className="w-full h-full"
							/>
						</div>
					)}

					{/* Loading overlay */}
					{isUpdatingCanvas && (
						<div className="absolute inset-0 bg-black/20 z-20 flex items-center justify-center">
							<div className="bg-white p-3 rounded-lg shadow-lg flex items-center space-x-2">
								<svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span className="text-sm">Generating...</span>
							</div>
						</div>
					)}

					{/* Grid overlay */}
					<div
						className="grid relative z-10"
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
							width: "1024px",
							height: "1024px",
						}}
					>
						{localGridData.map((cell) => (
							<div
								key={cell.id}
								className={`${cell.id === selectedSpace?.id
									? "border-blue-500 border-2"
									: "border border-gray-200"
									} ${!cell.ownerId ? "cursor-pointer hover:bg-blue-100/50" : ""}`}
								style={{
									backgroundColor: cell.ownerId ? "transparent" : "rgba(255,255,255,0.3)",
									position: "relative",
									width: "64px",
									height: "64px"
								}}
								onClick={() => handleLocalCellClick(cell)}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
