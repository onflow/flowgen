import Image from "next/image";

type PixelDetailsProps = {
	pixel: {
		id: number;
		x: number;
		y: number;
		owner: string | null;
		image: string | null;
	};
	onClose: () => void;
};

export default function PixelDetails({ pixel, onClose }: PixelDetailsProps) {
	return (
		<div className="p-6">
			<h2 className="text-xl font-bold mb-4">Pixel Details</h2>
			<Image
				src={pixel.image || "/default-image.png"}
				alt={`Pixel at ${pixel.x},${pixel.y}`}
				className="w-full rounded-lg mb-4"
				width={192}
				height={192}
			/>
			<p>
				Position: ({pixel.x}, {pixel.y})
			</p>
			<p>Owner: {pixel.owner}</p>
			<button onClick={onClose} className="mt-4 bg-gray-200 px-4 py-2 rounded">
				Close
			</button>
		</div>
	);
}
