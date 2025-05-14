import FlowGenCanvas from "FlowGenCanvas"

// Returns information about a specific pixel on the canvas
pub fun main(x: UInt16, y: UInt16): {String: AnyStruct} {
  // Check if the coordinates are valid
  if x >= FlowGenCanvas.canvasWidth || y >= FlowGenCanvas.canvasHeight {
    return {
      "error": "Coordinates out of bounds",
      "available": false,
      "valid": false
    }
  }
  
  // Check if the pixel is available
  let isAvailable = FlowGenCanvas.isPixelAvailable(x: x, y: y)
  
  // If available, return the current price
  if isAvailable {
    return {
      "available": true,
      "valid": true,
      "currentPrice": FlowGenCanvas.getCurrentPrice()
    }
  }
  
  // If not available, try to find ownership information
  // Note: This is a simplified implementation that would need to be expanded
  // to actually look up the owner based on the pixel coordinates
  
  return {
    "available": false,
    "valid": true,
    "message": "This pixel has already been purchased"
  }
}