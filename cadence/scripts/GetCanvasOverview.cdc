import "CanvasBackground"
import "FlowGenPixel"
access(all) fun main(): {String: AnyStruct} {
    let totalPixels: UInt64 = UInt64(CanvasBackground.CANVAS_WIDTH) * UInt64(CanvasBackground.CANVAS_HEIGHT)
    let soldPixels: UInt64 = FlowGenPixel.getTotalPixelsSold() // Assumes this function exists and calls FlowGenPixel.totalSupply
    let currentPrice: UFix64 = FlowGenPixel.getCurrentPixelPrice(x: 0, y: 0)

    let widthStr: String = FlowGenPixel.CANVAS_WIDTH.toString()
    let heightStr: String = FlowGenPixel.CANVAS_HEIGHT.toString()
    let resolution: String = widthStr.concat("x").concat(heightStr)
    
    return {
        "resolution": resolution,
        "totalPixels": totalPixels,
        "soldPixels": soldPixels,
        "currentPrice": currentPrice
    }
} 