"use client";

import React, { useState, useEffect } from "react";
import { Image, Camera, PlusSquare, Wallet, Loader2 } from "lucide-react";
import { useFlowMutate } from "@onflow/kit";
import { useCurrentFlowUser } from "@onflow/kit";
import * as fcl from "@onflow/fcl";
import { useAcquirePixelSpace } from "../hooks/pixel-hooks";
import { PixelOnChainData } from "@/lib/pixel-types";
import AIImageGenerator from "./ai-image-generator";
import CohesiveCanvasGenerator from "./cohesive-canvas-generator";

// Define the CanvasPixel interface for cohesive generation
interface CanvasPixel {
	x: number;
	y: number;
	color: string;
	prompt: string;
	imageUrl?: string;
}

type PurchasePanelProps = {
	selectedSpace: PixelOnChainData | null;
	currentPrice: number;
	onCancel: () => void;
	onPurchaseSuccess: () => void;
	// Add a prop to receive all existing pixels data
	existingPixels?: PixelOnChainData[];
};

export default function PurchasePanel({
	selectedSpace,
	currentPrice,
	onCancel,
	onPurchaseSuccess,
	existingPixels = [], // Default to empty array if not provided
}: PurchasePanelProps) {
	const [prompt, setPrompt] = useState("");
	const [style, setStyle] = useState("Pixel Art");
	const [imageURL, setImageURL] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [cohesiveImageUrl, setCohesiveImageUrl] = useState<string | null>(null);
	const [isCohesiveGenerating, setIsCohesiveGenerating] = useState(false);
	const { user, authenticate, unauthenticate } = useCurrentFlowUser();

	const {
		acquire,
		isLoading: isAcquiringPixel,
		error: acquirePixelError,
	} = useAcquirePixelSpace({
		onSuccess: () => {
			console.log("Pixel acquired successfully");
			onPurchaseSuccess();
		},
		onError: (error) => {
			console.error("Error acquiring pixel:", error);
		},
	});

	// Function to convert PixelOnChainData to CanvasPixel format
	const getAllExistingPixels = (): CanvasPixel[] => {
		// Filter out pixels that aren't taken
		return existingPixels
			.filter(pixel => pixel.isTaken)
			.map(pixel => {
				// Convert each PixelOnChainData to CanvasPixel format
				// Use default values for missing properties
				return {
					x: pixel.x,
					y: pixel.y,
					color: "#FFFFFF", // Default color
					prompt: "Existing pixel", // Default prompt since it doesn't exist on PixelOnChainData
					imageUrl: pixel.imageUrl || undefined // Default to undefined if property doesn't exist
				};
			});
	};

	// Function to generate cohesive canvas with all pixels
	const generateCohesiveCanvas = () => {
		if (!selectedSpace || !imageURL) {
			console.error("No selected space or image URL");
			return;
		}

		setIsCohesiveGenerating(true);

		// Get all existing pixels plus the new one being created
		const allPixelsForCohesive = [
			...getAllExistingPixels(),
			// Add the current pixel being created
			{
				x: selectedSpace.x,
				y: selectedSpace.y,
				color: "#FFFFFF",
				prompt: prompt || "Pixel art",
				imageUrl: imageURL
			}
		];

		// Call the API to generate a cohesive canvas
		fetch('/api/generate-cohesive-canvas', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				existingPixels: allPixelsForCohesive,
				canvasWidth: 64,
				canvasHeight: 64,
				newPixel: {
					x: selectedSpace.x,
					y: selectedSpace.y,
					prompt: prompt,
					imageUrl: imageURL
				}
			}),
		})
			.then(response => response.json())
			.then(data => {
				if (data.imageUrl) {
					console.log("Cohesive canvas generated:", data.imageUrl);
					setCohesiveImageUrl(data.imageUrl);
				} else {
					console.error("No image URL returned");
				}
			})
			.catch(error => {
				console.error("Error generating cohesive canvas:", error);
			})
			.finally(() => {
				setIsCohesiveGenerating(false);
			});
	};

	const handleGenerate = async () => {
		if (!selectedSpace || !user.loggedIn || !user.addr) {
			console.error(
				"User not logged in or address not available, or no space selected."
			);
			return;
		}

		setIsSubmitting(true);

		try {
			await acquire({
				x: selectedSpace.x,
				y: selectedSpace.y,
				prompt: prompt,
				style: style,
				imageURL: imageURL,
				flowPaymentAmount: currentPrice.toFixed(8),
				backendPaymentAmount: currentPrice + 0.01,
				userId: user.addr,
			});
		} catch (error) {
			console.error("Error during pixel acquisition process:", error);
		} finally {
			setIsSubmitting(false);
			onCancel();
		}
	};

	// Rest of your component code...
	if (!selectedSpace) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
				<PlusSquare className="h-12 w-12 mb-3" />
				<h3 className="text-lg font-medium mb-1 dark:text-gray-200">
					Select a Space
				</h3>
				<p className="text-sm">
					Click on any available space on the canvas to purchase and create your
					AI-generated image.
				</p>
			</div>
		);
	}

	if (!user.loggedIn) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
				<Wallet className="h-12 w-12 mb-3" />
				<button
					className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
					onClick={() => authenticate()}
				>
					Connect Wallet
				</button>
			</div>
		);
	}

	return (
		<div className="dark:text-gray-200">
			<h2 className="text-xl font-bold mb-4">
				{selectedSpace.isTaken ? "This space is taken" : "Purchase this Space"}
			</h2>
			<div className="mb-4">
				<div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 rounded-lg text-center">
					<div className="text-6xl mb-2 text-gray-400 dark:text-gray-500">
						<Image className="mx-auto h-16 w-16" />
					</div>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Position: ({selectedSpace.x}, {selectedSpace.y})
					</p>
				</div>
			</div>

			<div className="mb-6">
				<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					Your AI Prompt
				</label>
				<textarea
					className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 h-24 bg-white dark:bg-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
					placeholder="Describe the image you want to generate..."
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
				/>

				<AIImageGenerator
					prompt={prompt}
					style={style}
					onImageGenerated={(url) => setImageURL(url)}
				/>

				{imageURL && (
					<div className="mt-4 p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
						<p className="text-sm font-medium mb-2">Preview:</p>
						<img
							src={imageURL}
							alt="AI Generated Preview"
							className="rounded-lg max-h-60 mx-auto"
						/>
					</div>
				)}
			</div>

			<div className="mb-6">
				<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					Style Preset
				</label>
				<select
					className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-gray-200"
					value={style}
					onChange={(e) => setStyle(e.target.value)}
				>
					<option>Photorealistic</option>
					<option>Pixel Art</option>
					<option>Abstract</option>
					<option>Cyberpunk</option>
					<option>Minimalist</option>
				</select>
			</div>

			<div className="bg-blue-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
				<div className="flex justify-between mb-2 text-gray-800 dark:text-gray-300">
					<span>Price per cell</span>
					<span className="font-medium">{currentPrice.toFixed(2)} FLOW</span>
				</div>

				<div className="flex justify-between font-bold mt-2 text-gray-900 dark:text-gray-100">
					<span>Total</span>
					<span>{currentPrice.toFixed(2)} FLOW</span>
				</div>
			</div>

			{/* Generate Cohesive Canvas Button - shows after image is generated */}
			{imageURL && !selectedSpace.isTaken && (
				<div className="mb-6">
					<button
						onClick={generateCohesiveCanvas}
						disabled={isCohesiveGenerating}
						className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium flex items-center justify-center ${isCohesiveGenerating ? "opacity-50 cursor-not-allowed" : ""
							}`}
					>
						{isCohesiveGenerating ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Generating Cohesive Canvas...
							</>
						) : (
							"Generate Cohesive Canvas"
						)}
					</button>
				</div>
			)}

			{/* Display Cohesive Canvas if available */}
			{cohesiveImageUrl && (
				<div className="mb-6 p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
					<p className="text-sm font-medium mb-2">Cohesive Canvas Preview:</p>
					<img
						src={cohesiveImageUrl}
						alt="Cohesive Canvas Preview"
						className="rounded-lg w-full"
					/>
				</div>
			)}

			<div className="grid grid-cols-2 gap-3">
				<button
					className="bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 border border-gray-300 dark:border-gray-500 py-2 rounded-lg font-medium"
					onClick={onCancel}
					disabled={isGenerating || isSubmitting}
				>
					Cancel
				</button>
				<button
					className={`bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center ${isGenerating || isSubmitting || !prompt || !imageURL
						? "opacity-50 cursor-not-allowed dark:opacity-60"
						: ""
						}`}
					onClick={handleGenerate}
					disabled={
						selectedSpace.isTaken || isGenerating || isSubmitting || !prompt || !imageURL
					}
				>
					{isGenerating ? (
						<span>Generating...</span>
					) : isSubmitting ? (
						<span>Purchasing...</span>
					) : (
						<>
							<Wallet className="mr-1 h-4 w-4" />
							Purchase
						</>
					)}
				</button>
			</div>
		</div>
	);
}
