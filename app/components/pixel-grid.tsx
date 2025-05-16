import React, { useState } from 'react';
import { PixelData } from "@/lib/pixel-types";


type PixelGridProps = {
  gridSize: number;
  gridData: {
    id: number;
    x: number;
    y: number;
    owner: string | null;
    image: string | null;
  }[];
  onCellClick: (cell: any) => void;
  soldPercentage: number;
  currentPrice: number;
  selectedSpace: PixelData | null;
};

export default function PixelGrid({
  gridSize,
  gridData,
  onCellClick,
  soldPercentage,
  currentPrice,
  selectedSpace,
}: PixelGridProps) {

  const handleCellClick = (cell: any) => {
    console.log("handleCellClick", cell);
    onCellClick(cell);
  };

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">The Canvas</h2>
        <div className="text-sm bg-blue-100 text-blue-800 p-2 rounded-lg">
          <span className="font-bold">{(soldPercentage * 100).toFixed(1)}%</span> sold • Current price: <span className="font-bold">{currentPrice.toFixed(2)} FLOW</span> per cell
        </div>
      </div>

      <div className="border border-gray-300 inline-block">
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, 25px)` }}>
          {gridData.map((cell) => (
            <div
              key={cell.id}
              className={`h-6 w-6 border ${cell.id === selectedSpace?.id
                ? 'border-blue-500 border-2'
                : 'border-gray-200'
                } ${!cell.owner ? 'cursor-pointer hover:bg-blue-100' : ''}`}
              style={{
                backgroundColor: cell.owner ? '#f0f0f0' : 'white',
                backgroundImage: cell.image ? `url(${cell.image})` : 'none',
                backgroundSize: 'cover'
              }}
              onClick={() => handleCellClick(cell)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Click on any available white space to purchase
      </div>
    </div>
  );
}
