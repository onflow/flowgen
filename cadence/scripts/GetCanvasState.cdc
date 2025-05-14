import FlowGenCanvas from "FlowGenCanvas"

// Returns information about the overall canvas state
pub fun main(): {String: AnyStruct} {
  let totalPixels = FlowGenCanvas.totalPixels
  let soldPixels = FlowGenCanvas.soldPixels
  let soldPercentage = UFix64(soldPixels) / UFix64(totalPixels)
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