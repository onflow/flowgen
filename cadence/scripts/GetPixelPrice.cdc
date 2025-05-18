import "FlowGenPixel"

// Script: get_pixel_price.cdc
// Description: Fetches the current dynamic price for a pixel at the given x, y coordinates.
//
// Arguments:
// - x: UInt16, the x-coordinate of the pixel
// - y: UInt16, the y-coordinate of the pixel
//
// Returns: UFix64, the current price of the pixel

access(all) fun main(x: UInt16, y: UInt16): UFix64 {
    log("Script: GetPixelPrice.cdc - Fetching price for pixel (".concat(x.toString()).concat(", ").concat(y.toString()).concat(")"))
    
    let price = FlowGenPixel.getCurrentPixelPrice(x: x, y: y)
    
    log("Script: get_pixel_price.cdc - Calculated price: ".concat(price.toString()))
    
    return price
} 