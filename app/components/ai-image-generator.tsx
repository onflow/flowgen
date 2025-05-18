"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import OpenAI from "openai";


interface AIImageGeneratorProps {
    prompt: string;
    style: string;
    onImageGenerated: (imageUrl: string) => void;
}

export default function AIImageGenerator({
    prompt,
    style,
    onImageGenerated
}: AIImageGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateImage = async () => {
        if (!prompt) return;

        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch('/api/img-gen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, style }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.imageUrl) {
                    onImageGenerated(data.imageUrl);
                } else {
                    throw new Error('No image URL returned from API');
                }
            } else {
                throw new Error('Failed to generate image');
            }
        } catch (err) {
            console.error('Error generating image:', err);
            setError('Failed to generate image. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="mt-4">
            <button
                onClick={generateImage}
                disabled={!prompt || isGenerating}
                className={`w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium flex items-center justify-center ${!prompt || isGenerating ? "opacity-50 cursor-not-allowed" : ""
                    }`}
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                    </>
                ) : (
                    "Generate Preview Image"
                )}
            </button>

            {error && (
                <p className="mt-2 text-red-500 text-sm">{error}</p>
            )}
        </div>
    );
}
