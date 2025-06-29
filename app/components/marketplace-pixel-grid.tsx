import React from "react";
import { PixelData } from "@/lib/pixel-types";
import { Tag } from "lucide-react";

type MarketplacePixelGridProps = {
	gridSize: number;
	gridData: PixelData[];
	onCellClick: (cell: PixelData) => void;
	soldPercentage: number;
	currentPrice: number;
	selectedPixel: PixelData | null;
	backgroundImageUrl?: string;
};

export default function MarketplacePixelGrid({
	gridSize,
	gridData,
	onCellClick,
	soldPercentage,
	currentPrice,
	selectedPixel,
	backgroundImageUrl,
}: MarketplacePixelGridProps) {
	const handleCellClick = (cell: PixelData) => {
		console.log("handleCellClick", cell);
		onCellClick(cell);
	};

	// Helper to determine cell styling based on status
	const getCellClassName = (cell: PixelData) => {
		const isSelected = cell.id === selectedPixel?.id;
		const isAvailable = !cell.isTaken;
		const isListed = cell.isListed;

		let className = "relative border transition-all duration-200 ";

		// Border styling
		if (isSelected) {
			className += "border-blue-500 border-2 z-10 ";
		} else {
			className += "border-gray-200 ";
		}

		// Hover and cursor styling
		if (isAvailable) {
			className += "cursor-pointer hover:bg-blue-100 hover:border-blue-300 ";
		} else if (isListed) {
			className += "cursor-pointer hover:border-green-400 ";
		} else {
			className += "cursor-default ";
		}

		return className;
	};

	return (
		<div className="flex-1 p-4 overflow-auto flex flex-col items-center">
			{/* Stats Bar */}
			<div className="mb-6 flex justify-center items-center w-full max-w-md">
				<div className="text-sm bg-blue-100 text-blue-800 p-2 rounded-lg">
					<span className="font-bold">{soldPercentage.toFixed(1)}%</span> sold •
					price from:{" "}
					<span className="font-bold">{currentPrice.toFixed(2)} FLOW</span>
				</div>
			</div>

			{/* Instructions */}
			<div className="text-sm text-gray-600 text-center mb-6 space-y-1">
				<div>Click on any white space to purchase a new pixel</div>
				<div className="flex items-center justify-center gap-4">
					<span className="flex items-center gap-1">
						<div className="w-4 h-4 bg-gray-200 border border-gray-300"></div>
						Owned
					</span>
					<span className="flex items-center gap-1">
						<div className="w-4 h-4 bg-green-50 border border-green-300"></div>
						For Sale
					</span>
				</div>
			</div>

			{/* Grid Container */}
			<div
				className="border border-gray-300 inline-block shadow-lg"
				style={{
					backgroundImage: backgroundImageUrl
						? `url(${backgroundImageUrl})`
						: "none",
					backgroundSize: "cover",
					backgroundPosition: "center",
				}}
			>
				<div
					className="grid"
					style={{
						display: "grid",
						gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
						width: "1024px",
						height: "1024px",
					}}
				>
					{gridData.map((cell) => (
						<div
							key={`pixel-${cell.x}-${cell.y}`}
							className={getCellClassName(cell)}
							style={{
								backgroundImage: cell.ipfsImageCID
									? `url(https://${cell.ipfsImageCID}.ipfs.w3s.link)`
									: "none",
								backgroundSize: "cover",
								backgroundPosition: "center",
								// Add subtle green tint for listed pixels
								backgroundColor: cell.isListed && !cell.ipfsImageCID 
									? "rgba(34, 197, 94, 0.1)" 
									: "transparent",
							}}
							onClick={() => handleCellClick(cell)}
							title={
								cell.isTaken
									? cell.isListed
										? `For Sale: ${cell.price} FLOW`
										: `Owned by ${cell.ownerId?.slice(0, 8)}...`
									: "Available"
							}
						>
							{/* Show price tag for listed pixels */}
							{cell.isListed && (
								<div className="absolute top-0 right-0 bg-green-500 text-white p-1 rounded-bl-md">
									<Tag className="w-3 h-3" />
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}