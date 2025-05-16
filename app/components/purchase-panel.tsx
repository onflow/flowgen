"use client";

import React, { useState } from "react";
import { Image, Camera, PlusSquare, Wallet } from "lucide-react";
import { useFlowMutate } from "@onflow/kit";
import { useCurrentFlowUser } from "@onflow/kit";
import * as fcl from "@onflow/fcl";
import { useAcquirePixelSpace } from "../../lib/pixel-hooks";

type PurchasePanelProps = {
	selectedSpace: {
		id: number;
		x: number;
		y: number;
		owner: string | null;
		image: string | null;
	} | null;
	currentPrice: number;
	onCancel: () => void;
	onPixelPurchased: (pixel: {
		id: number;
		x: number;
		y: number;
		owner: string | null;
		image: string | null;
	}) => void;
	onPurchaseSuccess: () => void;
};

export default function PurchasePanel({
	selectedSpace,
	currentPrice,
	onCancel,
	onPixelPurchased,
	onPurchaseSuccess,
}: PurchasePanelProps) {
	const [prompt, setPrompt] = useState("");
	const [style, setStyle] = useState("pixel-art");
	const [imageURL, setImageURL] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { user, authenticate, unauthenticate } = useCurrentFlowUser();

	const {
		acquire,
		isLoading: isAcquiringPixel,
		error: acquirePixelError,
	} = useAcquirePixelSpace();

	const handleGenerate = async () => {
		if (!selectedSpace || !user.loggedIn || !user.addr) {
			console.error(
				"User not logged in or address not available, or no space selected."
			);
			return;
		}

		let imageURL = "";
		await new Promise((resolve) => setTimeout(resolve, 1500));
		imageURL = `https://picsum.photos/seed/${Math.random()}/300/300`;
		console.log("Simulated image generated:", imageURL);

		setIsGenerating(true);
		try {
			// 1. Generate random image
			setIsSubmitting(true);

			// 2. Purchase transaction
			const transactionId = await fcl.mutate({
				cadence: `
					import FungibleToken from 0x9a0766d93b6608b7
					import NonFungibleToken from 0x631e88ae7f1d7c20
					import FlowGenPixel from 0xFlowGenPixel
					import FlowGenCanvas from 0xFlowGenCanvas

					transaction(
						x: UInt16,
						y: UInt16,
						name: String,
						description: String,
						thumbnailURL: String,
						aiPrompt: String,
						imageURI: String,
						pixelArtURI: String,
						imageHash: String,
						paymentAmount: UFix64
					) {
						let paymentVault: @FungibleToken.Vault
						let pixelCollection: &FlowGenPixel.Collection

						prepare(signer: AuthAccount) {
							// Get payment vault
							let vaultRef = signer.borrow<&FungibleToken.Vault>(from: /storage/flowTokenVault)
								?? panic("Could not borrow Flow token vault")
							self.paymentVault <- vaultRef.withdraw(amount: paymentAmount)

							// Setup pixel collection if needed
							if signer.borrow<&FlowGenPixel.Collection>(from: /storage/FlowGenPixelCollection) == nil {
								signer.save(<-FlowGenPixel.createEmptyCollection(), to: /storage/FlowGenPixelCollection)
							}

							self.pixelCollection = signer.borrow<&FlowGenPixel.Collection>(from: /storage/FlowGenPixelCollection)
								?? panic("Could not borrow pixel collection")
						}

						execute {
							// Purchase pixel
							FlowGenCanvas.purchasePixel(
								x: x,
								y: y,
								payment: <-self.paymentVault,
								metadata: {
									"name": name,
									"description": description,
									"thumbnail": thumbnailURL,
									"prompt": aiPrompt,
									"image": imageURI,
									"pixelArt": pixelArtURI,
									"hash": imageHash
								},
								pixelCollection: self.pixelCollection
							)
						}
					}
				`,
				args: (arg, t) => [
					arg(selectedSpace.x, t.UInt16),
					arg(selectedSpace.y, t.UInt16),
					arg(`Pixel Art #${selectedSpace.x}-${selectedSpace.y}`, t.String),
					arg(prompt, t.String),
					arg(imageURL, t.String),
					arg(prompt, t.String),
					arg(imageURL, t.String),
					arg(imageURL, t.String),
					arg(`hash-${Date.now()}`, t.String),
					arg((currentPrice + 0.01).toFixed(8), t.UFix64),
				],
				limit: 999,
			});

			// 3. Monitor transaction
			fcl.tx(transactionId).subscribe((transaction) => {
				if (transaction.status === 4) {
					// status 4 is Sealed
					const newPixel = {
						...selectedSpace,
						owner: user?.addr || null,
						image: imageURL,
					};
					onPixelPurchased(newPixel);
					setIsGenerating(false);
					setIsSubmitting(false);
				}
			});
		} catch (error) {
			console.error("Error simulating image generation:", error);
			setIsGenerating(false);
			return;
		}

		try {
			const purchaseData = {
				x: selectedSpace.x,
				y: selectedSpace.y,
				prompt: prompt,
				style: style,
				imageURL: imageURL,
				paymentAmount: currentPrice + 0.01,
				userId: user.addr,
			};

			console.log("Attempting to acquire pixel space with data:", purchaseData);
			const result = await acquire(
				purchaseData.x,
				purchaseData.y,
				purchaseData.prompt,
				purchaseData.style,
				purchaseData.imageURL,
				purchaseData.paymentAmount,
				purchaseData.userId
			);

			if (result.success) {
				console.log(
					"Pixel space acquired successfully. Pixel ID:",
					result.pixelId
				);
				onPixelPurchased({
					...selectedSpace,
					owner: user.addr,
					image: imageURL,
				});
				onPurchaseSuccess();
			} else {
				console.error("Failed to acquire pixel space:", result.error);
			}
		} catch (error) {
			console.error("Error during pixel acquisition process:", error);
		} finally {
			setIsSubmitting(false);
			onCancel();
		}
	};

	console.log("selectedSpace", selectedSpace);

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
	} else if (selectedSpace.owner === user?.addr) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
				<h3 className="text-lg font-medium mb-1">You already own this space</h3>
				<div className="mb-4">
					<div className="bg-white border border-gray-300 p-4 rounded-lg text-center">
						<div className="text-6xl mb-2 text-gray-400">
							<img
								src={selectedSpace.image || ""}
								alt="Selected space"
								width={64}
								height={64}
								className="mx-auto h-16 w-16"
							/>
						</div>
						<p className="text-sm text-gray-500">
							Position: ({selectedSpace.x}, {selectedSpace.y})
						</p>
					</div>
				</div>
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
			<h2 className="text-xl font-bold mb-4">Purchase this Space</h2>
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
				<div className="flex justify-between mb-2 border-b border-blue-100 dark:border-gray-700 pb-2 text-gray-800 dark:text-gray-300">
					<span>Network fee</span>
					<span className="font-medium">0.01 FLOW</span>
				</div>
				<div className="flex justify-between font-bold mt-2 text-gray-900 dark:text-gray-100">
					<span>Total</span>
					<span>{(currentPrice + 0.01).toFixed(2)} FLOW</span>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<button
					className="bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 border border-gray-300 dark:border-gray-500 py-2 rounded-lg font-medium"
					onClick={onCancel}
					disabled={isGenerating || isSubmitting}
				>
					Cancel
				</button>
				<button
					className={`bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center ${
						isGenerating || isSubmitting || !prompt
							? "opacity-50 cursor-not-allowed dark:opacity-60"
							: ""
					}`}
					onClick={handleGenerate}
					disabled={isGenerating || isSubmitting || !prompt}
				>
					{isGenerating ? (
						<span>Generating...</span>
					) : isSubmitting ? (
						<span>Purchasing...</span>
					) : (
						<>
							<Camera className="mr-1 h-4 w-4" />
							Generate & Buy
						</>
					)}
				</button>
			</div>
		</div>
	);
}
