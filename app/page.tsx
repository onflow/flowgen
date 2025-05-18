import AIPixelCanvas from "./components/ai-pixel-canvas";
import { headers } from "next/headers"; // Import
export const dynamic = "force-dynamic"; // Add this line

export default function Home() {
	headers(); // Call it to ensure dynamic rendering

	return <AIPixelCanvas />;
}
