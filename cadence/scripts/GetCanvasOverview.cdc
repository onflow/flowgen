import "FlowGenPixel"

access(all) fun main(): {String: AnyStruct} {
    let totalPixels: UInt64 = UInt64(FlowGenPixel.CANVAS_WIDTH) * UInt64(FlowGenPixel.CANVAS_HEIGHT)
    let soldPixels: UInt64 = FlowGenPixel.getTotalPixelsSold() // Assumes this function exists and calls FlowGenPixel.totalSupply
    let currentPrice: UFix64 = FlowGenPixel.getCurrentPixelPrice(x: 0, y: 0)

    return {
        "totalPixels": totalPixels,
        "soldPixels": soldPixels,
        "currentPrice": currentPrice
    }
} 