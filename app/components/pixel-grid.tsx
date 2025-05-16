import React, { useState } from "react";
import { PixelOnChainData } from "@/lib/pixel-types";
type Pixel = {
	id: number;
	x: number;
	y: number;
	owner: string | null;
	image: string | null;
};

type PixelGridProps = {
	gridSize: number;
	gridData: PixelOnChainData[];
	onCellClick: (cell: PixelOnChainData) => void;
	soldPercentage: number;
	currentPrice: number;
};

export default function PixelGrid({
	gridSize,
	gridData,
	onCellClick,
	soldPercentage,
	currentPrice,
}: PixelGridProps) {
	const [selectedPixel, setSelectedPixel] = useState<Pixel | null>(null);

	const handleCellClick = (cell: PixelOnChainData) => {
		console.log("handleCellClick", cell);
		onCellClick(cell);
	};

	return (
		<div className="flex-1 p-4 overflow-auto">
			<div className="mb-4 flex justify-between items-center">
				<h2 className="text-xl font-bold">The Canvas</h2>
				<div className="text-sm bg-blue-100 text-blue-800 p-2 rounded-lg">
					<span className="font-bold">
						{(soldPercentage * 100).toFixed(1)}%
					</span>{" "}
					sold • Current price:{" "}
					<span className="font-bold">{currentPrice.toFixed(2)} FLOW</span> per
					cell
				</div>
			</div>

			<div className="border border-gray-300 inline-block">
				<div
					className="grid"
					style={{
						display: "grid",
						gridTemplateColumns: `repeat(${gridSize}, 25px)`,
					}}
				>
					{gridData.map((cell, index) => {
						return (
							<div
								key={`pixel-${cell.x}-${cell.y}`}
								className={`h-6 w-6 border border-gray-200 ${
									!cell.isTaken ? "cursor-pointer hover:bg-blue-100" : ""
								}`}
								style={{
									backgroundColor: cell.isTaken ? "red" : "white",
									backgroundSize: "cover",
								}}
								onClick={() => handleCellClick(cell)}
							/>
						);
					})}
				</div>
			</div>

			<div className="mt-4 text-sm text-gray-600">
				Click on any available white space to purchase
			</div>
		</div>
	);
}
