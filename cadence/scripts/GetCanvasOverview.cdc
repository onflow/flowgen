import FlowGenCanvas from "FlowGenCanvas"

access(all) fun main(): {String: AnyStruct} {
    let widthStr = FlowGenCanvas.canvasWidth.toString()
    let heightStr = FlowGenCanvas.canvasHeight.toString()
    let resolution: String = widthStr.concat("x").concat(heightStr)
    let totalPixels: UInt64 = FlowGenCanvas.totalPixels
    let soldPixels: UInt64 = FlowGenCanvas.getSoldPixels() // Assumes this function exists and calls FlowGenPixel.totalSupply
    let currentPrice: UFix64 = FlowGenCanvas.getCurrentPrice()

    return {
        "resolution": resolution,
        "totalPixels": totalPixels,
        "soldPixels": soldPixels,
        "currentPrice": currentPrice
    }
} 