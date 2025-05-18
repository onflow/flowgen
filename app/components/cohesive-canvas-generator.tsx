"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface CanvasPixel {
    x: number;
    y: number;
    color: string;
    prompt: string;
    imageUrl?: string;
}

interface CohesiveCanvasGeneratorProps {
    existingPixels: CanvasPixel[];
    canvasWidth: number;
    canvasHeight: number;
    onCohesiveImageGenerated: (imageUrl: string) => void;
}

export default function CohesiveCanvasGenerator({
    existingPixels,
    canvasWidth,
    canvasHeight,
    onCohesiveImageGenerated
}: CohesiveCanvasGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cohesiveImageUrl, setCohesiveImageUrl] = useState<string | null>(null);

    // Generate a cohesive canvas when a new pixel is added
    const generateCohesiveCanvas = async (newPixel: CanvasPixel) => {
        if (existingPixels.length === 0 && !newPixel) {
            setError("No pixels to generate from");
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch('/api/generate-cohesive-canvas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    existingPixels,
                    canvasWidth,
                    canvasHeight,
                    newPixel
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate cohesive canvas');
            }

            const data = await response.json();

            if (data.imageUrl) {
                setCohesiveImageUrl(data.imageUrl);
                onCohesiveImageGenerated(data.imageUrl);
            } else {
                throw new Error('No image URL returned');
            }
        } catch (err) {
            console.error('Error:', err);
            setError('Failed to generate cohesive canvas. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="mt-4">
            {isGenerating && (
                <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
                    <span>Generating cohesive canvas...</span>
                </div>
            )}

            {error && (
                <p className="mt-2 text-red-500 text-sm">{error}</p>
            )}

            {cohesiveImageUrl && !isGenerating && (
                <div className="mt-4 border border-gray-300 rounded-lg overflow-hidden">
                    <img
                        src={cohesiveImageUrl}
                        alt="Cohesive Canvas"
                        className="w-full h-auto"
                    />
                </div>
            )}

            <div className="mt-4">
                <button
                    onClick={() => {
                        // Trigger generation when user clicks, using the most recently added pixel
                        const lastPixel = existingPixels[existingPixels.length - 1];
                        if (lastPixel) {
                            generateCohesiveCanvas(lastPixel);
                        } else {
                            setError("No pixels to generate from");
                        }
                    }}
                    disabled={existingPixels.length === 0 || isGenerating}
                    className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium ${existingPixels.length === 0 || isGenerating ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                >
                    Generate Cohesive Canvas
                </button>
            </div>
        </div>
    );
}
