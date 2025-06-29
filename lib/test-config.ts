// Global configuration for testing
export const TEST_CONFIG = {
  // Set to false to disable AI generation and use random colored images instead
  ENABLE_AI_GENERATION: false,
};

// Generate a random color image data URL for testing
export function generateRandomColorImage(width: number = 256, height: number = 256): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    // Fallback: return a data URL for a solid color
    return `data:image/svg+xml;base64,${btoa(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)"/></svg>`)}`;
  }
  
  // Generate random HSL color
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 30); // 60-90%
  const lightness = 50 + Math.floor(Math.random() * 20);  // 50-70%
  
  ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  ctx.fillRect(0, 0, width, height);
  
  // Add some simple pattern for variety
  ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`;
  const patternSize = 32;
  for (let x = 0; x < width; x += patternSize * 2) {
    for (let y = 0; y < height; y += patternSize * 2) {
      ctx.fillRect(x, y, patternSize, patternSize);
    }
  }
  
  return canvas.toDataURL('image/jpeg', 0.8);
}