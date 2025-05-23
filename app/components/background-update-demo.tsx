"use client";

import { useState } from "react";
import { useBackgroundUpdateStream } from "@/app/hooks/background-update-hooks";
import BackgroundUpdateProgress from "./background-update-progress";

export default function BackgroundUpdateDemo() {
	const [showDemo, setShowDemo] = useState(false);
	const {
		triggerBackgroundUpdateStream,
		progress,
		isUpdating,
		result,
		error,
		reset,
	} = useBackgroundUpdateStream();

	const handleStartDemo = async () => {
		setShowDemo(true);
		// Example parameters - you'd replace these with real data
		await triggerBackgroundUpdateStream({
			eventType: "PixelMinted",
			transactionId: `demo_tx_${Date.now()}`,
			pixelId: "123",
			x: 10,
			y: 15,
			ipfsImageCID: "bafybeiabc123...", // Example IPFS CID
			triggeringAiImageID: 456,
		});
	};

	const handleReset = () => {
		reset();
		setShowDemo(false);
	};

	return (
		<div className="max-w-md mx-auto p-6">
			<h2 className="text-2xl font-bold mb-4">Background Update Demo</h2>

			{!showDemo ? (
				<button
					onClick={handleStartDemo}
					className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium"
				>
					Start Demo Background Update
				</button>
			) : (
				<div className="space-y-4">
					<BackgroundUpdateProgress
						progress={progress}
						isUpdating={isUpdating}
						error={error}
						result={result}
						onComplete={(result) => {
							console.log("Update completed:", result);
						}}
						onError={(error) => {
							console.error("Update failed:", error);
						}}
					/>

					{(result || error) && (
						<button
							onClick={handleReset}
							className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium"
						>
							Reset Demo
						</button>
					)}
				</div>
			)}
		</div>
	);
}
