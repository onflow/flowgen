import "FlowGenPixelMarketplace"

// Script to get listing information for a specific pixel from a seller
access(all) fun main(sellerAddress: Address, pixelId: UInt64): FlowGenPixelMarketplace.ListingInfo? {
    let listingManager = getAccount(sellerAddress)
        .capabilities.borrow<&{FlowGenPixelMarketplace.ListingPublic}>(
            FlowGenPixelMarketplace.ListingPublicPath
        )
    
    if let manager = listingManager {
        return manager.getListingInfo(pixelId: pixelId)
    }
    
    return nil
}