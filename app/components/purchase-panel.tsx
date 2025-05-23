"use client";

import React, { useEffect, useState } from "react";
import { Image as ImageIcon, Camera, PlusSquare, Wallet } from "lucide-react";
import { useFlowMutate } from "@onflow/kit";
import { useCurrentFlowUser } from "@onflow/kit";
import * as fcl from "@onflow/fcl";
import { useAcquirePixelSpace, usePixelPrice } from "../hooks/pixel-hooks";
import { PixelOnChainData } from "@/lib/pixel-types";
import { PixelSpaceResult } from "@/lib/pixel-types";
import AIImageGenerator from "./ai-image-generator";
import {
	CUTE_ART_STYLE_LABELS,
	CUTE_ART_STYLES,
	CuteArtStyle,
} from "@/lib/prompt-style";
import Image from "next/image";
import { useBackgroundUpdateStream } from "@/app/hooks/background-update-hooks";
import BackgroundUpdateProgress from "./background-update-progress";

type PurchasePanelProps = {
	selectedSpace: PixelOnChainData | null;
	currentPrice: number;
	onCancel: () => void;
	onPurchaseSuccess: () => void;
};

export default function PurchasePanel({
	selectedSpace,
	currentPrice,
	onCancel,
	onPurchaseSuccess,
}: PurchasePanelProps) {
	const [prompt, setPrompt] = useState("");
	const [style, setStyle] = useState<CuteArtStyle>("pixelArt");
	const [imageURL, setImageURL] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showBackgroundProgress, setShowBackgroundProgress] = useState(false);
	const [pixelPurchaseData, setPixelPurchaseData] = useState<{
		txId: string;
		pixelId: string;
		x: number;
		y: number;
		ipfsImageCID: string;
		triggeringAiImageID?: number;
	} | null>(null);

	const { user, authenticate, unauthenticate } = useCurrentFlowUser();

	// Background update streaming hook
	const {
		triggerBackgroundUpdateStream,
		progress,
		isUpdating,
		result,
		error: bgUpdateError,
		reset: resetBgUpdate,
	} = useBackgroundUpdateStream();

	const x = selectedSpace?.x;
	const y = selectedSpace?.y;
	const { price: pixelPrice, refetch: refetchPixelPrice } = usePixelPrice({
		x: x,
		y: y,
	});

	useEffect(() => {
		// refetch the pixel price when the space changes
		refetchPixelPrice();
	}, [x, y, refetchPixelPrice]);

	// Reset form state when selected space changes
	useEffect(() => {
		if (selectedSpace) {
			console.log("🔄 Selected space changed, resetting form state");
			setPrompt("");
			setImageURL("");
			setStyle("pixelArt");
			setIsSubmitting(false);
			setShowBackgroundProgress(false);
			setPixelPurchaseData(null);
			resetBgUpdate();
		}
	}, [selectedSpace?.x, selectedSpace?.y, resetBgUpdate]);

	const {
		acquire,
		isLoading: isAcquiringPixel,
		error: acquirePixelError,
		data: purchaseData,
	} = useAcquirePixelSpace({
		onSuccess: (purchaseResult) => {
			console.log("🎯 PIXEL PURCHASE SUCCESS CALLBACK TRIGGERED");
			console.log("purchaseResult:", purchaseResult);

			const result = purchaseResult as PixelSpaceResult;

			// Instead of immediately calling onPurchaseSuccess, prepare for background update
			if (result && result.success && selectedSpace && result.txId) {
				console.log("✅ All conditions met, starting background update...");
				console.log("Using IPFS CID:", result.ipfsImageCID);

				setPixelPurchaseData({
					txId: result.txId,
					pixelId: result.pixelId || "unknown",
					x: selectedSpace.x,
					y: selectedSpace.y,
					ipfsImageCID: result.ipfsImageCID || "unknown",
					triggeringAiImageID: result.triggeringAiImageID,
				});
				setShowBackgroundProgress(true);
				setIsSubmitting(false); // Hide "Purchasing..." state

				// Trigger background update with progress
				console.log("🚀 Triggering background update stream...");
				console.log(
					"Using triggering AI Image ID:",
					result.triggeringAiImageID
				);
				triggerBackgroundUpdateStream({
					eventType: "PixelMinted",
					transactionId: result.txId,
					pixelId: result.pixelId || "0",
					x: selectedSpace.x,
					y: selectedSpace.y,
					ipfsImageCID: result.ipfsImageCID || "unknown",
					triggeringAiImageID: result.triggeringAiImageID,
				});
			} else {
				console.log("❌ Conditions not met for background update:");
				console.log("result:", result);
				console.log("result exists:", !!result);
				console.log("result.success:", result?.success);
				console.log("result.success is true:", result?.success === true);
				console.log("selectedSpace:", selectedSpace);
				console.log("selectedSpace exists:", !!selectedSpace);
				console.log("result.txId:", result?.txId);
				console.log("result.txId exists:", !!result?.txId);

				// Show which specific condition is failing
				if (!result) console.log("🔴 FAILING: result is falsy");
				if (result && !result.success)
					console.log("🔴 FAILING: result.success is falsy");
				if (!selectedSpace) console.log("🔴 FAILING: selectedSpace is falsy");
				if (!result?.txId) console.log("🔴 FAILING: result.txId is falsy");

				// If no background update, just call success immediately
				onPurchaseSuccess();
			}
		},
		onError: (error) => {
			console.error("❌ Error acquiring pixel:", error);
			setIsSubmitting(false);
		},
	});

	// Handle background update completion
	useEffect(() => {
		if (result && showBackgroundProgress) {
			console.log("Background update completed successfully", result);
			// Small delay to let users see the completion state
			setTimeout(() => {
				// Reset all internal states before calling onPurchaseSuccess
				resetPurchaseState();
				onPurchaseSuccess();
			}, 2000);
		}
	}, [result, showBackgroundProgress, onPurchaseSuccess]);

	// Handle background update error
	useEffect(() => {
		if (bgUpdateError && showBackgroundProgress) {
			console.error("Background update failed:", bgUpdateError);
			// Even if background update fails, the pixel purchase was successful
			// So we still call onPurchaseSuccess after a delay
			setTimeout(() => {
				// Reset all internal states before calling onPurchaseSuccess
				resetPurchaseState();
				onPurchaseSuccess();
			}, 3000);
		}
	}, [bgUpdateError, showBackgroundProgress, onPurchaseSuccess]);

	// Debug: Track showBackgroundProgress state changes
	useEffect(() => {
		console.log(
			"🎭 showBackgroundProgress changed to:",
			showBackgroundProgress
		);
	}, [showBackgroundProgress]);

	// Debug: Track progress changes
	useEffect(() => {
		console.log("📈 Progress changed:", progress);
	}, [progress]);

	// Debug: Track isUpdating changes
	useEffect(() => {
		console.log("🔄 isUpdating changed to:", isUpdating);
	}, [isUpdating]);

	// Function to reset all purchase-related states
	const resetPurchaseState = () => {
		console.log("🧹 Resetting purchase state...");
		setShowBackgroundProgress(false);
		setPixelPurchaseData(null);
		setIsSubmitting(false);
		setPrompt("");
		setImageURL("");
		setStyle("pixelArt");
		resetBgUpdate();
	};

	const handleGenerate = async () => {
		console.log("🎬 PURCHASE BUTTON CLICKED");
		console.log("selectedSpace:", selectedSpace);
		console.log("user:", user);
		console.log("user?.loggedIn:", user?.loggedIn);
		console.log("user?.addr:", user?.addr);

		if (!selectedSpace || !user?.loggedIn || !user?.addr) {
			console.error(
				"❌ User not logged in or address not available, or no space selected."
			);
			return;
		}

		try {
			console.log("🚀 Starting pixel acquisition...");
			setIsSubmitting(true);

			const acquireParams = {
				x: selectedSpace.x,
				y: selectedSpace.y,
				prompt: prompt,
				style: style,
				imageURL: imageURL,
				imageMediaType: "image/jpeg",
				flowPaymentAmount: pixelPrice === null ? "0" : pixelPrice.toFixed(8),
				backendPaymentAmount: pixelPrice === null ? 0 : pixelPrice,
				userId: user?.addr,
			};

			console.log("📋 Acquire parameters:", acquireParams);

			await acquire(acquireParams);
			console.log("✅ Acquire function completed");
		} catch (error) {
			console.error("💥 Error during pixel acquisition process:", error);
			setIsSubmitting(false);
		}
	};

	const handleCancel = () => {
		if (showBackgroundProgress) {
			// If background update is in progress, don't allow cancel
			return;
		}
		resetPurchaseState();
		onCancel();
	};

	const handleRetryBackgroundUpdate = () => {
		if (pixelPurchaseData) {
			console.log(
				"🔄 Retrying background update with IPFS CID:",
				pixelPurchaseData.ipfsImageCID
			);
			resetBgUpdate();
			triggerBackgroundUpdateStream({
				eventType: "PixelMinted",
				transactionId: pixelPurchaseData.txId,
				pixelId: pixelPurchaseData.pixelId,
				x: pixelPurchaseData.x,
				y: pixelPurchaseData.y,
				ipfsImageCID: pixelPurchaseData.ipfsImageCID,
				triggeringAiImageID: pixelPurchaseData.triggeringAiImageID,
			});
		}
	};

	const handleManualContinue = () => {
		console.log("🚀 Manual continue clicked");
		resetPurchaseState();
		onPurchaseSuccess();
	};

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

	if (!user?.loggedIn) {
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

	// Show background update progress after successful purchase
	if (showBackgroundProgress) {
		return (
			<div className="dark:text-gray-200">
				<h2 className="text-xl font-bold mb-4">
					🎉 Pixel Purchased Successfully!
				</h2>

				<div className="mb-4">
					<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg text-center">
						<p className="text-green-800 dark:text-green-200 font-medium">
							Your pixel at ({selectedSpace.x}, {selectedSpace.y}) has been
							acquired!
						</p>
						<p className="text-green-600 dark:text-green-300 text-sm mt-1">
							Now updating the canvas background...
						</p>
					</div>
				</div>

				<BackgroundUpdateProgress
					progress={progress}
					isUpdating={isUpdating}
					error={bgUpdateError}
					result={result}
					onComplete={(result) => {
						console.log(
							"Background update completed in purchase panel:",
							result
						);
					}}
					onError={(error) => {
						console.error("Background update failed in purchase panel:", error);
					}}
					className="mb-4"
				/>

				{/* Show retry button if background update fails */}
				{bgUpdateError && !isUpdating && (
					<div className="mt-4">
						<button
							onClick={handleRetryBackgroundUpdate}
							className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg font-medium"
						>
							Retry Background Update
						</button>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
							Your pixel purchase was successful. The background update can be
							retried.
						</p>
					</div>
				)}

				{/* Manual continue button (in case auto-continue fails) */}
				{(result || bgUpdateError) && (
					<div className="mt-4">
						<button
							onClick={handleManualContinue}
							className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium"
						>
							Continue
						</button>
					</div>
				)}
			</div>
		);
	}

	// Original purchase form
	return (
		<div className="dark:text-gray-200">
			<h2 className="text-xl font-bold mb-4">
				{selectedSpace.isTaken ? "This space is taken" : "Purchase this Space"}
			</h2>
			<div className="mb-4">
				<div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 rounded-lg text-center">
					{!imageURL && (
						<div className="text-6xl mb-2 text-gray-400 dark:text-gray-500">
							<ImageIcon className="mx-auto h-16 w-16" />
						</div>
					)}
					{imageURL && (
						<div>
							<p className="text-sm font-medium mb-2">Preview:</p>
							<Image
								src={imageURL}
								alt="AI Generated Preview"
								className="rounded-lg max-h-48 mx-auto"
								width={192}
								height={192}
							/>
						</div>
					)}
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
				<div className="mb-6">
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Style Preset
					</label>
					<select
						className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-gray-200"
						value={style}
						onChange={(e) => setStyle(e.target.value as CuteArtStyle)}
					>
						{CUTE_ART_STYLES.map((artStyle: CuteArtStyle) => (
							<option key={artStyle} value={artStyle}>
								{CUTE_ART_STYLE_LABELS[artStyle]}
							</option>
						))}
					</select>
				</div>
				<AIImageGenerator
					prompt={prompt}
					style={style}
					onImageGenerated={(url) => setImageURL(url)}
				/>
			</div>

			<div className="bg-blue-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
				<div className="flex justify-between mb-2 text-gray-800 dark:text-gray-300">
					<span>Price per cell</span>
					<span className="font-medium">
						{pixelPrice ? pixelPrice.toFixed(2) : "0"} FLOW
					</span>
				</div>

				<div className="flex justify-between font-bold mt-2 text-gray-900 dark:text-gray-100">
					<span>Total</span>
					<span>{pixelPrice ? pixelPrice.toFixed(2) : "0"} FLOW</span>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<button
					className="bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 border border-gray-300 dark:border-gray-500 py-2 rounded-lg font-medium"
					onClick={handleCancel}
					disabled={isGenerating || isSubmitting}
				>
					Cancel
				</button>
				<button
					className={`bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center ${
						isGenerating || isSubmitting || !prompt || !imageURL
							? "opacity-50 cursor-not-allowed dark:opacity-60"
							: ""
					}`}
					onClick={handleGenerate}
					disabled={
						selectedSpace.isTaken ||
						isGenerating ||
						isSubmitting ||
						!prompt ||
						!imageURL
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
