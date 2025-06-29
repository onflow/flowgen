import "FlowGenPixel"
import "FlowGenPixelMarketplace"
import "NonFungibleToken"

// Script to get pixel information including marketplace listing status
access(all) fun main(x: UInt16, y: UInt16): {String: AnyStruct} {
    let pixelInfo: {String: AnyStruct} = {}
    
    // Get basic pixel info
    pixelInfo["x"] = x
    pixelInfo["y"] = y
    pixelInfo["isTaken"] = FlowGenPixel.isPixelMinted(x: x, y: y)
    
    if let pixelId = FlowGenPixel.getPixelNFTID(x: x, y: y) {
        pixelInfo["pixelId"] = pixelId
        
        // Try to find the owner by checking common addresses
        // In production, you'd have a registry or event-based tracking
        // For now, we'll return basic info
        pixelInfo["nftId"] = pixelId.toString()
        
        // Check if pixel is listed in marketplace
        // This would require iterating through potential seller addresses
        // For demonstration, we'll leave this as a TODO
        pixelInfo["isListed"] = false
        pixelInfo["listingPrice"] = nil
        pixelInfo["sellerAddress"] = nil
    } else {
        // Not minted yet - get primary sale price
        pixelInfo["primaryPrice"] = FlowGenPixel.getCurrentPixelPrice(x: x, y: y)
        pixelInfo["isListed"] = false
    }
    
    return pixelInfo
}