"use client";

import { useState } from "react";
import AIImageGenerator from "./ai-image-generator";
import { CUTE_ART_STYLES, CUTE_ART_STYLE_LABELS } from "@/lib/prompt-style";
import { CuteArtStyle } from "@/lib/prompt-style";
import { useAcquirePixelSpace } from "@/app/hooks/pixel-hooks";

interface GenerateResult {
	canvasUrl?: string;
	pixelUrl?: string;
	success?: boolean;
}

interface PurchasePanelProps {
	selectedSpace: { x: number; y: number; id: number } | null;
	onCancel: () => void;
	currentPrice?: number;
	pixelPrice?: number;
	onPurchaseSuccess?: () => Promise<void>;
	onGenerate?: (prompt: string, style: string) => Promise<GenerateResult | undefined>;
	isUpdatingCanvas?: boolean;
	canvasUrl?: string | null;
	userId?: string;
}

export function PurchasePanel({
	selectedSpace,
	onCancel,
	currentPrice,
	pixelPrice = currentPrice,
	onPurchaseSuccess,
	onGenerate,
	isUpdatingCanvas = false,
	canvasUrl = null,
	userId
}: PurchasePanelProps) {
	const [prompt, setPrompt] = useState("");
	const [style, setStyle] = useState("pixel-art");
	const [imageGenerated, setImageGenerated] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [pixelUrl, setPixelUrl] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		acquire,
		isLoading: isAcquireLoading,
		error: acquireError
	} = useAcquirePixelSpace({
		onSuccess: (data) => {
			if (onPurchaseSuccess) onPurchaseSuccess();
		},
		onError: (error) => {
			console.error("Error acquiring pixel:", error);
		}
	});

	const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setPrompt(e.target.value);
		setImageGenerated(false); // Reset generated state when prompt changes
	};

	const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setStyle(e.target.value);
		setImageGenerated(false); // Reset generated state when style changes
	};

	const handleGenerate = async () => {
		if (!prompt || !onGenerate) return;
		setShowPreview(false);
		setPixelUrl(null);

		try {
			const result = await onGenerate(prompt, style);

			if (result && result.pixelUrl) {
				setPixelUrl(result.pixelUrl);
			}
			setImageGenerated(true);
			setShowPreview(true);
		} catch (error) {
			console.error("Error generating image:", error);
		}
	};

	const handlePurchase = async () => {
		if (!selectedSpace || !pixelUrl) return;
		setIsSubmitting(true);

		try {
			const { x, y } = selectedSpace;

			await acquire({
				x,
				y,
				prompt: prompt || "",
				style: style as CuteArtStyle,
				imageURL: `${window.location.origin}${pixelUrl}`,
				flowPaymentAmount: pixelPrice?.toString() || "10.0",
				userId: userId || "",
				imageMediaType: "image/png",
				backendPaymentAmount: 0,
			});

			if (onPurchaseSuccess) {
				onPurchaseSuccess();
			}
		} catch (error) {
			console.error("Error purchasing pixel:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
			<h2 className="text-2xl font-bold mb-4">Purchase Pixel</h2>
			<p className="mb-4 text-gray-600">
				Position: ({selectedSpace?.x}, {selectedSpace?.y})
			</p>

			<div className="mb-4">
				<label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
					Enter Prompt
				</label>
				<input
					type="text"
					id="prompt"
					className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
					value={prompt}
					onChange={handlePromptChange}
					placeholder="Describe what you want to see..."
				/>
			</div>

			<div className="mb-6">
				<label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-1">
					Style
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
				{/* <AIImageGenerator
					prompt={prompt}
					style={style}
					onImageGenerated={(url) => setImageURL(url)}
				/> */}
			</div>

			<div className="flex flex-col space-y-2 mb-4">
				<button
					onClick={onCancel}
					className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
					disabled={isUpdatingCanvas}
				>
					Cancel
				</button>

				<button
					onClick={handleGenerate}
					disabled={isUpdatingCanvas || !prompt}
					className={`px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isUpdatingCanvas || !prompt ? "opacity-50 cursor-not-allowed" : ""
						}`}
				>
					{isUpdatingCanvas ? "Generating..." : "Generate Preview"}
				</button>

				<button
					onClick={handlePurchase}
					disabled={isUpdatingCanvas || !imageGenerated}
					className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isUpdatingCanvas || !imageGenerated ? "opacity-50 cursor-not-allowed" : ""
						}`}
				>
					{`Purchase (${pixelPrice?.toFixed(2) || "0.00"} FLOW)`}
				</button>
			</div>

			{imageGenerated && (
				<div className="mt-2 text-center text-sm text-green-600">
					✓ Image generated successfully! Click Purchase to confirm.
				</div>
			)}

			{showPreview && canvasUrl && (
				<div className="mb-4 border rounded-md overflow-hidden">
					<div className="text-sm font-medium text-gray-700 p-2 bg-gray-50">Preview</div>
					<div className="relative" style={{ height: "200px" }}>
						<img
							src={`${canvasUrl}?t=${Date.now()}`}
							alt="Generated pixel art"
							className="w-full h-full object-contain"
						/>
						{selectedSpace && (
							<div
								className="absolute border-2 border-red-500"
								style={{
									left: `${(selectedSpace.x / 16) * 100}%`,
									top: `${(selectedSpace.y / 16) * 100}%`,
									width: `${(1 / 16) * 100}%`,
									height: `${(1 / 16) * 100}%`
								}}
							/>
						)}
					</div>
				</div>
			)}

			{pixelUrl && (
				<div className="mt-4 border rounded-md overflow-hidden">
					<div className="text-sm font-medium text-gray-700 p-2 bg-gray-50">Your Pixel</div>
					<div className="p-2">
						<img
							src={`${pixelUrl}?t=${Date.now()}`}
							alt="Generated pixel"
							className="w-full object-contain"
							style={{ maxHeight: "200px" }}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
