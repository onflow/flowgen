import FlowGenCanvas from "FlowGenCanvas" // Changed to named import

// Returns information about the overall canvas state
access(all) fun main(): {String: AnyStruct} {
  let totalPixels = FlowGenCanvas.totalPixels
  let soldPixels = FlowGenCanvas.getSoldPixels()
  
  var soldPercentage: UFix64 = 0.0
  if totalPixels > 0 { // Avoid division by zero
    soldPercentage = UFix64(soldPixels) / UFix64(totalPixels) * 100.0 // As percentage
  }
  
  let currentPrice = FlowGenCanvas.getCurrentPrice()
  
  return {
    "totalPixels": totalPixels,
    "soldPixels": soldPixels,
    "soldPercentage": soldPercentage,
    "currentPrice": currentPrice,
    "canvasWidth": FlowGenCanvas.canvasWidth,
    "canvasHeight": FlowGenCanvas.canvasHeight
  }
}