import React, { useState } from "react";
import { PixelData } from "@/lib/pixel-types";
import { useCurrentBackgroundInfo } from "../hooks/pixel-hooks";

type PixelGridProps = {
	gridSize: number;
	gridData: PixelData[];
	onCellClick: (cell: any) => void;
	soldPercentage: number;
	currentPrice: number;
	selectedSpace: PixelData | null;
};

export default function PixelGrid({
	gridSize,
	gridData,
	onCellClick,
	soldPercentage,
	currentPrice,
	selectedSpace,
}: PixelGridProps) {
	const backgroundImage = useCurrentBackgroundInfo();
	const handleCellClick = (cell: any) => {
		console.log("handleCellClick", cell);
		onCellClick(cell);
	};

	return (
		<div className="flex-1 p-4 overflow-auto flex flex-col items-center">
			<div className="mb-6 flex justify-center items-center w-full max-w-md">
				<div className="text-sm bg-blue-100 text-blue-800 p-2 rounded-lg">
					<span className="font-bold">{soldPercentage.toFixed(1)}%</span> sold •
					price from:{" "}
					<span className="font-bold">{currentPrice.toFixed(2)} FLOW</span>
				</div>
			</div>

			<div className="text-sm text-gray-600 text-center mb-6">
				Click on any available white space to purchase
			</div>

			<div
				className="border border-gray-300 inline-block"
				style={{
					backgroundImage: backgroundImage?.imageUrl
						? `url(${backgroundImage.imageUrl})`
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
							key={cell.id}
							className={`border ${
								cell.id === selectedSpace?.id
									? "border-blue-500 border-2"
									: "border-gray-200"
							} ${!cell.ownerId ? "cursor-pointer hover:bg-blue-100" : ""}`}
							style={{
								backgroundImage: cell.ipfsImageCID
									? `url(https://${cell.ipfsImageCID}.ipfs.w3s.link)`
									: "none",
								backgroundSize: "cover",
							}}
							onClick={() => handleCellClick(cell)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
