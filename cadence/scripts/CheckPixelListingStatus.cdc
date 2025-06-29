import "FlowGenPixelMarketplace"

// Script to check if a pixel is listed for sale and get its price
access(all) fun main(sellerAddress: Address, pixelId: UInt64): {Bool, UFix64?} {
    let isListed = FlowGenPixelMarketplace.isPixelListed(
        sellerAddress: sellerAddress,
        pixelId: pixelId
    )
    
    var price: UFix64? = nil
    
    if isListed {
        let listingManager = getAccount(sellerAddress)
            .capabilities.borrow<&{FlowGenPixelMarketplace.ListingPublic}>(
                FlowGenPixelMarketplace.ListingPublicPath
            )
        
        if let manager = listingManager {
            if let listing = manager.getListingInfo(pixelId: pixelId) {
                price = listing.price
            }
        }
    }
    
    return {isListed, price}
}