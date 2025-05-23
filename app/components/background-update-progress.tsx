"use client";

import { useEffect } from "react";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

interface ProgressUpdate {
	step: string;
	progress: number;
	message: string;
	error?: string;
	result?: any;
}

interface BackgroundUpdateProgressProps {
	progress: ProgressUpdate;
	isUpdating: boolean;
	error: string | null;
	result: any;
	onComplete?: (result: any) => void;
	onError?: (error: string) => void;
	className?: string;
}

const stepIcons: { [key: string]: string } = {
	initializing: "🚀",
	cleanup: "🧹",
	checking_processed: "🔍",
	acquiring_lock: "🔒",
	fetching_background: "📥",
	generating_image: "🎨",
	uploading_ipfs: "📤",
	updating_chain: "⛓️",
	finalizing: "✨",
	complete: "✅",
	error: "❌",
	already_processed: "✅",
	already_processing: "⏳",
};

const stepLabels: { [key: string]: string } = {
	initializing: "Initializing",
	cleanup: "Cleaning up",
	checking_processed: "Checking status",
	acquiring_lock: "Acquiring lock",
	fetching_background: "Getting background",
	generating_image: "Generating image",
	uploading_ipfs: "Uploading to IPFS",
	updating_chain: "Updating blockchain",
	finalizing: "Finalizing",
	complete: "Complete",
	error: "Error",
	already_processed: "Already processed",
	already_processing: "Already processing",
};

export default function BackgroundUpdateProgress({
	progress,
	isUpdating,
	error,
	result,
	onComplete,
	onError,
	className = "",
}: BackgroundUpdateProgressProps) {
	useEffect(() => {
		if (result && onComplete) {
			onComplete(result);
		}
	}, [result, onComplete]);

	useEffect(() => {
		if (error && onError) {
			onError(error);
		}
	}, [error, onError]);

	if (!isUpdating && !progress.step && !error) {
		return null;
	}

	const isComplete =
		progress.step === "complete" || progress.step === "already_processed";
	const isError = progress.step === "error" || !!error;
	const isProcessing = progress.step === "already_processing";

	return (
		<div className={`bg-white rounded-lg shadow-lg border p-6 ${className}`}>
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-lg font-semibold text-gray-900">
					Background Update
				</h3>
				<div className="flex items-center">
					{isComplete && <CheckCircle className="h-6 w-6 text-green-500" />}
					{isError && <AlertCircle className="h-6 w-6 text-red-500" />}
					{isUpdating && !isComplete && !isError && (
						<Clock className="h-6 w-6 text-blue-500 animate-spin" />
					)}
				</div>
			</div>

			{/* Progress Bar */}
			<div className="mb-4">
				<div className="flex justify-between text-sm text-gray-600 mb-2">
					<span>Progress</span>
					<span>{Math.round(progress.progress)}%</span>
				</div>
				<div className="w-full bg-gray-200 rounded-full h-2">
					<div
						className={`h-2 rounded-full transition-all duration-300 ${
							isError
								? "bg-red-500"
								: isComplete
								? "bg-green-500"
								: "bg-blue-500"
						}`}
						style={{
							width: `${Math.max(0, Math.min(100, progress.progress))}%`,
						}}
					/>
				</div>
			</div>

			{/* Current Step */}
			{progress.step && (
				<div className="flex items-center space-x-3 mb-3">
					<span className="text-2xl">{stepIcons[progress.step] || "⚙️"}</span>
					<div>
						<div className="font-medium text-gray-900">
							{stepLabels[progress.step] || progress.step}
						</div>
						<div className="text-sm text-gray-600">{progress.message}</div>
					</div>
				</div>
			)}

			{/* Error Message */}
			{(error || progress.error) && (
				<div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
					<div className="flex">
						<AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
						<div className="text-sm text-red-700">
							<strong>Error:</strong> {error || progress.error}
						</div>
					</div>
				</div>
			)}

			{/* Success Result */}
			{result && progress.step === "complete" && (
				<div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
					<div className="flex">
						<CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
						<div className="text-sm text-green-700">
							<strong>Success!</strong> Background updated successfully.
							{result.newBackgroundCID && (
								<div className="mt-1 font-mono text-xs">
									New CID: {result.newBackgroundCID}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Already Processing Message */}
			{isProcessing && (
				<div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
					<div className="flex">
						<Clock className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
						<div className="text-sm text-yellow-700">
							<strong>In Progress:</strong> This background update is already
							being processed by another request.
						</div>
					</div>
				</div>
			)}

			{/* Time Estimate for Long Steps */}
			{progress.step === "generating_image" && isUpdating && (
				<div className="mt-3 text-xs text-gray-500 italic">
					💡 Image generation typically takes 20-40 seconds
				</div>
			)}
		</div>
	);
}
