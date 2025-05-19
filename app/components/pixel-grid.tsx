"use client";

import { useState, useEffect } from "react";

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
		<div className="relative mx-auto" style={{ width: '1024px', height: '1024px' }}>
			{/* Force reload the image with timestamp to prevent caching */}
			{backgroundUrl && (
				<img
					src={`${backgroundUrl}?t=${Date.now()}`}
					alt="Canvas background"
					className="absolute inset-0 z-0"
					style={{ width: '1024px', height: '1024px', objectFit: 'contain' }}
					onError={(e) => console.error("Failed to load background:", e)}
					onLoad={() => console.log("Background loaded successfully")}
				/>
			)}

			{/* Grid cells overlay */}
			<div className="grid relative z-10" style={{
				display: "grid",
				gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
				width: "1024px",
				height: "1024px",
				border: '1px solid #eaeaea',
			}}>
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
	);
}
