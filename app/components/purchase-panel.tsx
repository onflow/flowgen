"use client";

import React, { useState } from "react";
import { Image, Camera, PlusSquare, Wallet } from "lucide-react";
import { useFlowMutate } from "@onflow/kit";
import { useCurrentFlowUser } from "@onflow/kit";

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
};

export default function PurchasePanel({
	selectedSpace,
	currentPrice,
	onCancel,
}: PurchasePanelProps) {
	const [prompt, setPrompt] = useState("");
	const [style, setStyle] = useState("Photorealistic");
	const [isGenerating, setIsGenerating] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const { user, authenticate, unauthenticate } = useCurrentFlowUser();

	const handleGenerate = async () => {
		if (!selectedSpace || !user.loggedIn) return;

		setIsGenerating(true);

		// In a real implementation, this would call an AI generation API
		// and return the generated image URL
		try {
			// Simulate an API call with a timeout
			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Simulate a generated image URL for demonstration
			const imageURL = `https://picsum.photos/seed/${Math.random()}/300/300`;

			// Now submit the transaction to purchase the pixel
			setIsSubmitting(true);

			// This would be the actual Flow transaction in a real implementation
			/*
      const transaction = executeTransaction(
        `
        import FlowGenCanvas from 0xFlowGenCanvas
        import NonFungibleToken from 0xNonFungibleToken
        import FungibleToken from 0xFungibleToken

        transaction(
          x: UInt16,
          y: UInt16,
          prompt: String,
          style: String,
          imageURL: String,
          paymentAmount: UFix64
        ) {
          // Local variables
          let paymentVault: @FungibleToken.Vault
          let receiver: &{FungibleToken.Receiver}
          let collectionRef: &{NonFungibleToken.CollectionPublic}
          let adminRef: &FlowGenCanvas.Admin
          
          prepare(acct: AuthAccount) {
            // Setup collection, withdraw payment, get references
            // Implementation from PurchasePixel.cdc
          }
          
          execute {
            // Validate payment and pixel availability
            // Mint NFT
            // Implementation from PurchasePixel.cdc
          }
        }
        `,
        [
          selectedSpace.x,
          selectedSpace.y,
          prompt,
          style,
          imageURL,
          (currentPrice + 0.01).toFixed(8) // Include network fee, formatted as UFix64
        ],
        {
          onSuccess: (txId) => {
            console.log("Transaction success:", txId);
            setIsGenerating(false);
            setIsSubmitting(false);
            onCancel();
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            setIsGenerating(false);
            setIsSubmitting(false);
          }
        }
      );
      
      await transaction.execute();
      */

			// Simulate transaction success
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Reset states and notify the parent component
			setIsGenerating(false);
			setIsSubmitting(false);
			onCancel();
		} catch (error) {
			console.error("Error generating or purchasing:", error);
			setIsGenerating(false);
			setIsSubmitting(false);
		}
	};

	if (!selectedSpace) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
				<PlusSquare className="h-12 w-12 mb-3" />
				<h3 className="text-lg font-medium mb-1">Select a Space</h3>
				<p className="text-sm">
					Click on any available space on the canvas to purchase and create your
					AI-generated image.
				</p>
			</div>
		);
	}

	if (!user.loggedIn) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
				<Wallet className="h-12 w-12 mb-3" />
				<button
					className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium"
					onClick={() => authenticate()}
				>
					Connect Wallet
				</button>
			</div>
		);
	}

	return (
		<div>
			<h2 className="text-xl font-bold mb-4">Purchase this Space</h2>
			<div className="mb-4">
				<div className="bg-white border border-gray-300 p-4 rounded-lg text-center">
					<div className="text-6xl mb-2 text-gray-400">
						<Image className="mx-auto h-16 w-16" />
					</div>
					<p className="text-sm text-gray-500">
						Position: ({selectedSpace.x}, {selectedSpace.y})
					</p>
				</div>
			</div>

			<div className="mb-6">
				<label className="block text-sm font-medium text-gray-700 mb-2">
					Your AI Prompt
				</label>
				<textarea
					className="w-full border border-gray-300 rounded-lg p-3 h-24"
					placeholder="Describe the image you want to generate..."
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
				/>
			</div>

			<div className="mb-6">
				<label className="block text-sm font-medium text-gray-700 mb-2">
					Style Preset
				</label>
				<select
					className="w-full border border-gray-300 rounded-lg p-3 bg-white"
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

			<div className="bg-blue-50 p-4 rounded-lg mb-6">
				<div className="flex justify-between mb-2">
					<span>Price per cell</span>
					<span className="font-medium">{currentPrice.toFixed(2)} FLOW</span>
				</div>
				<div className="flex justify-between mb-2 border-b border-blue-100 pb-2">
					<span>Network fee</span>
					<span className="font-medium">0.01 FLOW</span>
				</div>
				<div className="flex justify-between font-bold mt-2">
					<span>Total</span>
					<span>{(currentPrice + 0.01).toFixed(2)} FLOW</span>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<button
					className="bg-white text-gray-600 border border-gray-300 py-2 rounded-lg font-medium"
					onClick={onCancel}
					disabled={isGenerating || isSubmitting}
				>
					Cancel
				</button>
				<button
					className={`bg-blue-600 text-white py-2 rounded-lg font-medium flex items-center justify-center ${
						isGenerating || isSubmitting || !prompt
							? "opacity-50 cursor-not-allowed"
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
