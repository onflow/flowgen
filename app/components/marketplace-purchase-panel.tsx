"use client";

import React, { useEffect, useState } from "react";
import { Image as ImageIcon, Camera, PlusSquare, Wallet, ShoppingCart, Tag } from "lucide-react";
import { useCurrentFlowUser } from "@onflow/kit";
import { useBuyListedPixel, useCheckPixelListingStatus } from "../hooks/marketplace-hooks";
import { usePixelPrice, useAcquirePixelSpace } from "../hooks/pixel-hooks";
import { PixelData } from "@/lib/pixel-types";
import AIImageGenerator from "./ai-image-generator";
import {
	CUTE_ART_STYLE_LABELS,
	CUTE_ART_STYLES,
	CuteArtStyle,
} from "@/lib/prompt-style";

type MarketplacePurchasePanelProps = {
	selectedPixel: PixelData | null;
	onCancel: () => void;
	onPurchaseSuccess: () => void;
};

export default function MarketplacePurchasePanel({
	selectedPixel,
	onCancel,
	onPurchaseSuccess,
}: MarketplacePurchasePanelProps) {
	const [prompt, setPrompt] = useState("");
	const [style, setStyle] = useState<CuteArtStyle>("crochetAmigurumi");
	const [imageURL, setImageURL] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [autoRelist, setAutoRelist] = useState(true); // Default to auto-relist
	
	const { user, authenticate } = useCurrentFlowUser();

	// Check if pixel is listed on marketplace
	const { price: listedPrice } = useCheckPixelListingStatus(
		selectedPixel?.sellerAddress || null,
		selectedPixel?.nftId || null
	);

	// Get primary sale price
	const { price: primaryPrice, refetch: refetchPixelPrice } = usePixelPrice({
		x: selectedPixel?.x,
		y: selectedPixel?.y,
	});

	// Refetch pixel price when selected pixel changes
	useEffect(() => {
		if (selectedPixel?.x !== undefined && selectedPixel?.y !== undefined) {
			refetchPixelPrice();
		}
	}, [selectedPixel?.x, selectedPixel?.y, refetchPixelPrice]);

	// Determine pixel state
	const isPrimarySale = selectedPixel && !selectedPixel.isTaken;
	const isOwnedButNotListed = selectedPixel && selectedPixel.isTaken && !selectedPixel.isListed;
	const isListedForSale = selectedPixel && selectedPixel.isTaken && selectedPixel.isListed;
	
	const currentPrice = isPrimarySale ? primaryPrice : listedPrice;
	const sellerAddress = (isListedForSale) ? selectedPixel?.sellerAddress || selectedPixel?.ownerId : null;

	// Debug logging
	useEffect(() => {
		if (selectedPixel) {
			console.log("🔍 Pixel pricing debug:", {
				pixel: `(${selectedPixel.x}, ${selectedPixel.y})`,
				isTaken: selectedPixel.isTaken,
				isListed: selectedPixel.isListed,
				isPrimarySale,
				isOwnedButNotListed,
				isListedForSale,
				primaryPrice,
				listedPrice,
				currentPrice,
				sellerAddress,
			});
		}
	}, [selectedPixel, isPrimarySale, primaryPrice, listedPrice, currentPrice, sellerAddress]);

	// Primary purchase hook (for new pixels)
	const { acquire: acquirePixel } = useAcquirePixelSpace({
		onSuccess: (data) => {
			console.log("🎯 Primary pixel purchase successful:", data);
			setIsSubmitting(false);
			onPurchaseSuccess();
		},
		onError: (error) => {
			console.error("❌ Error purchasing new pixel:", error);
			setIsSubmitting(false);
		},
	});

	// Secondary purchase hook (for marketplace pixels)
	const { buyPixel } = useBuyListedPixel();

	// Reset form when selected pixel changes
	useEffect(() => {
		if (selectedPixel) {
			setPrompt("");
			setImageURL("");
			setStyle("crochetAmigurumi");
			setIsSubmitting(false);
			setAutoRelist(true);
		}
	}, [selectedPixel?.x, selectedPixel?.y]);


	const handlePurchase = async () => {
		if (!selectedPixel || !user?.loggedIn || !user?.addr) {
			console.error("User not logged in or no pixel selected");
			return;
		}

		setIsSubmitting(true);

		try {
			if (isPrimarySale) {
				// For primary sales, use the original acquire system
				if (!prompt || !imageURL) {
					console.error("Need prompt and generated image for primary sale");
					setIsSubmitting(false);
					return;
				}

				await acquirePixel({
					x: selectedPixel.x,
					y: selectedPixel.y,
					prompt: prompt,
					style: style,
					imageURL: imageURL,
					imageMediaType: "image/jpeg",
					flowPaymentAmount: primaryPrice?.toString() || "0",
					backendPaymentAmount: primaryPrice?.toString() || "0",
					userId: user.addr,
				});
			} else if (isListedForSale) {
				// For secondary sales, use marketplace system
				await buyPixel(sellerAddress || "", selectedPixel.nftId || "");
				setIsSubmitting(false);
				onPurchaseSuccess();
			}
		} catch (error) {
			console.error("Purchase failed:", error);
			setIsSubmitting(false);
		}
	};

	if (!selectedPixel) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
				<PlusSquare className="h-12 w-12 mb-3" />
				<h3 className="text-lg font-medium mb-1 dark:text-gray-200">
					Select a Pixel
				</h3>
				<p className="text-sm">
					Click on any pixel to view details and purchase options.
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


	// Show purchase panel
	return (
		<div className="dark:text-gray-200">
			<h2 className="text-xl font-bold mb-4">
				{isPrimarySale ? "Purchase New Pixel" : 
				 isListedForSale ? "Buy from Marketplace" : 
				 "Pixel Not Available"}
			</h2>

			{/* Pixel Preview */}
			<div className="mb-4">
				<div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 rounded-lg text-center">
					{!isPrimarySale && selectedPixel.ipfsImageCID ? (
						<div>
							<p className="text-sm font-medium mb-2">Current Pixel:</p>
							<img
								src={`https://${selectedPixel.ipfsImageCID}.ipfs.w3s.link`}
								alt="Pixel Image"
								className="rounded-lg max-h-48 mx-auto"
								width={192}
								height={192}
							/>
						</div>
					) : isPrimarySale && !imageURL ? (
						<div className="text-6xl mb-2 text-gray-400 dark:text-gray-500">
							<ImageIcon className="mx-auto h-16 w-16" />
							<p className="text-sm mt-2">Generate an image to preview</p>
						</div>
					) : null}
					<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
						Position: ({selectedPixel.x}, {selectedPixel.y})
					</p>
					{!isPrimarySale && selectedPixel.ownerId && (
						<p className="text-sm text-gray-500 dark:text-gray-400">
							Owner: {selectedPixel.ownerId.slice(0, 8)}...
						</p>
					)}
					{isOwnedButNotListed && (
						<div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
							<p className="text-sm text-yellow-800 dark:text-yellow-200">
								This pixel is owned but not currently for sale
							</p>
						</div>
					)}
				</div>
			</div>

			{/* AI Generation for Primary Sales */}
			{isPrimarySale && (
				<div className="mb-6">
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Your AI Prompt
					</label>
					<textarea
						className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 h-24 bg-white dark:bg-gray-700 dark:text-gray-200"
						placeholder="Describe the image you want to generate..."
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
					/>
					<div className="mb-4">
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
						onImageGenerated={(url) => {
							console.log("Image generated:", url);
							setImageURL(url);
						}}
					/>
					
					{/* Preview Generated Image */}
					{imageURL && (
						<div className="mt-4">
							<p className="text-sm font-medium mb-2">Generated Preview:</p>
							<img
								src={imageURL}
								alt="AI Generated Preview"
								className="rounded-lg mx-auto"
								width={256}
								height={256}
							/>
						</div>
					)}
				</div>
			)}

			{/* Auto-relist Toggle - only show for purchaseable pixels */}
			{(isPrimarySale || isListedForSale) && (
				<div className="mb-6">
					<label className="flex items-center space-x-2">
						<input
							type="checkbox"
							checked={autoRelist}
							onChange={(e) => setAutoRelist(e.target.checked)}
							className="rounded border-gray-300 dark:border-gray-600"
						/>
						<span className="text-sm text-gray-700 dark:text-gray-300">
							Automatically list for resale (+25% markup)
						</span>
					</label>
				</div>
			)}

			{/* Pricing Info - only show for purchaseable pixels */}
			{(isPrimarySale || isListedForSale) && (
				<div className="bg-blue-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
					{isPrimarySale ? (
						<div className="flex justify-between mb-2 text-gray-800 dark:text-gray-300">
							<span>Price</span>
							<span className="font-medium">{currentPrice || "Loading..."} FLOW</span>
						</div>
					) : isListedForSale ? (
						<>
							<div className="flex justify-between mb-2 text-gray-800 dark:text-gray-300">
								<span>Listed Price</span>
								<span className="font-medium">{currentPrice || "0"} FLOW</span>
							</div>
							{selectedPixel.originalPurchasePrice && (
								<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
									<span>Original Price</span>
									<span>{selectedPixel.originalPurchasePrice} FLOW</span>
								</div>
							)}
						</>
					) : null}
					{autoRelist && (isPrimarySale || isListedForSale) && (
						<div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
							<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
								<span>Your resale price will be</span>
								<span className="font-medium">
									{((Number(currentPrice) || 0) * 1.25).toFixed(2)} FLOW
								</span>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Action Buttons */}
			<div className="grid grid-cols-2 gap-3">
				<button
					className="bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 border border-gray-300 dark:border-gray-500 py-2 rounded-lg font-medium"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</button>
				{isOwnedButNotListed ? (
					<button
						className="bg-gray-400 dark:bg-gray-600 text-white py-2 rounded-lg font-medium cursor-not-allowed opacity-50"
						disabled={true}
					>
						Not For Sale
					</button>
				) : (
					<button
						className={`bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center ${
							(isPrimarySale && (!prompt || !imageURL)) || isSubmitting || (!currentPrice || currentPrice <= 0)
								? "opacity-50 cursor-not-allowed"
								: ""
						}`}
						onClick={handlePurchase}
						disabled={
							(isPrimarySale && (!prompt || !imageURL)) || 
							isSubmitting || 
							(!currentPrice || currentPrice <= 0)
						}
					>
						{isSubmitting ? (
							<span>Processing...</span>
						) : (
							<>
								{isPrimarySale ? <Wallet /> : <ShoppingCart />}
								<span className="ml-2">
									{isPrimarySale ? "Purchase" : "Buy Now"}
								</span>
							</>
						)}
					</button>
				)}
			</div>
		</div>
	);
}