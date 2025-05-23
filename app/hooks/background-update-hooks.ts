import { useCallback, useState } from "react";

interface BackgroundUpdateParams {
	eventType: "PixelMinted" | "PixelImageUpdated";
	transactionId: string;
	pixelId: string;
	x: number;
	y: number;
	ipfsImageCID: string;
	triggeringAiImageID?: number;
}

interface ProgressUpdate {
	step: string;
	progress: number;
	message: string;
	error?: string;
	result?: any;
}

export function useBackgroundUpdate() {
	const triggerBackgroundUpdate = useCallback(
		async (params: BackgroundUpdateParams) => {
			try {
				const response = await fetch("/api/background-update", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(params),
				});

				if (!response.ok) {
					throw new Error(
						`Failed to trigger background update: ${await response.text()}`
					);
				}

				const result = await response.json();
				console.log("Background update triggered:", result);
				return result;
			} catch (error) {
				console.error("Error triggering background update:", error);
				throw error;
			}
		},
		[]
	);

	return { triggerBackgroundUpdate };
}

// New streaming hook with progress updates
export function useBackgroundUpdateStream() {
	const [progress, setProgress] = useState<ProgressUpdate>({
		step: "",
		progress: 0,
		message: "",
	});
	const [isUpdating, setIsUpdating] = useState(false);
	const [result, setResult] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);

	const triggerBackgroundUpdateStream = useCallback(
		async (params: BackgroundUpdateParams) => {
			console.log("🌊 BACKGROUND UPDATE STREAM TRIGGERED");
			console.log("params:", params);

			setIsUpdating(true);
			setError(null);
			setResult(null);
			setProgress({
				step: "connecting",
				progress: 0,
				message: "Connecting to server...",
			});

			try {
				console.log("🔗 Making fetch request to /api/background-update-stream");
				const response = await fetch("/api/background-update-stream", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(params),
				});

				console.log(
					"📡 Response received:",
					response.status,
					response.statusText
				);

				if (!response.ok) {
					throw new Error(
						`Failed to start background update: ${await response.text()}`
					);
				}

				const reader = response.body?.getReader();
				const decoder = new TextDecoder();

				if (!reader) {
					throw new Error("Failed to get response reader");
				}

				console.log("📖 Starting to read stream...");
				while (true) {
					const { done, value } = await reader.read();

					if (done) {
						console.log("📄 Stream ended");
						break;
					}

					// Decode the chunk and parse SSE format
					const chunk = decoder.decode(value);
					console.log("📦 Received chunk:", chunk);

					const lines = chunk.split("\n");

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6)) as ProgressUpdate;
								console.log("🔄 Progress update:", data);
								setProgress(data);

								if (data.step === "complete") {
									console.log("✅ Background update completed!");
									setResult(data.result);
									setIsUpdating(false);
								} else if (data.step === "error") {
									console.log("❌ Background update error:", data.error);
									setError(data.error || "Unknown error occurred");
									setIsUpdating(false);
								}
							} catch (parseError) {
								console.warn("⚠️ Failed to parse SSE data:", line, parseError);
							}
						}
					}
				}
			} catch (fetchError) {
				console.error("💥 Error during background update stream:", fetchError);
				setError(
					fetchError instanceof Error
						? fetchError.message
						: "Unknown error occurred"
				);
				setIsUpdating(false);
			}
		},
		[]
	);

	const reset = useCallback(() => {
		setProgress({ step: "", progress: 0, message: "" });
		setIsUpdating(false);
		setResult(null);
		setError(null);
	}, []);

	return {
		triggerBackgroundUpdateStream,
		progress,
		isUpdating,
		result,
		error,
		reset,
	};
}

// Hook to listen for pixel events and trigger background updates
export function usePixelEventListener() {
	const { triggerBackgroundUpdate } = useBackgroundUpdate();

	const handlePixelMinted = useCallback(
		async (event: any) => {
			try {
				await triggerBackgroundUpdate({
					eventType: "PixelMinted",
					transactionId: event.transactionId,
					pixelId: event.data.id,
					x: event.data.x,
					y: event.data.y,
					ipfsImageCID: event.data.ipfsImageCID,
					triggeringAiImageID: event.data.initialAiImageNftID,
				});
			} catch (error) {
				console.error("Failed to handle PixelMinted event:", error);
			}
		},
		[triggerBackgroundUpdate]
	);

	const handlePixelImageUpdated = useCallback(
		async (event: any) => {
			try {
				await triggerBackgroundUpdate({
					eventType: "PixelImageUpdated",
					transactionId: event.transactionId,
					pixelId: event.data.pixelId,
					x: event.data.x,
					y: event.data.y,
					ipfsImageCID: event.data.ipfsImageCID,
					triggeringAiImageID: event.data.newAiImageNftID,
				});
			} catch (error) {
				console.error("Failed to handle PixelImageUpdated event:", error);
			}
		},
		[triggerBackgroundUpdate]
	);

	return { handlePixelMinted, handlePixelImageUpdated };
}

// Hook to listen for pixel events and trigger streaming background updates
export function usePixelEventListenerStream() {
	const { triggerBackgroundUpdateStream, progress, isUpdating, result, error } =
		useBackgroundUpdateStream();

	const handlePixelMinted = useCallback(
		async (event: any) => {
			try {
				await triggerBackgroundUpdateStream({
					eventType: "PixelMinted",
					transactionId: event.transactionId,
					pixelId: event.data.id,
					x: event.data.x,
					y: event.data.y,
					ipfsImageCID: event.data.ipfsImageCID,
					triggeringAiImageID: event.data.initialAiImageNftID,
				});
			} catch (error) {
				console.error("Failed to handle PixelMinted event:", error);
			}
		},
		[triggerBackgroundUpdateStream]
	);

	const handlePixelImageUpdated = useCallback(
		async (event: any) => {
			try {
				await triggerBackgroundUpdateStream({
					eventType: "PixelImageUpdated",
					transactionId: event.transactionId,
					pixelId: event.data.pixelId,
					x: event.data.x,
					y: event.data.y,
					ipfsImageCID: event.data.ipfsImageCID,
					triggeringAiImageID: event.data.newAiImageNftID,
				});
			} catch (error) {
				console.error("Failed to handle PixelImageUpdated event:", error);
			}
		},
		[triggerBackgroundUpdateStream]
	);

	return {
		handlePixelMinted,
		handlePixelImageUpdated,
		progress,
		isUpdating,
		result,
		error,
	};
}
