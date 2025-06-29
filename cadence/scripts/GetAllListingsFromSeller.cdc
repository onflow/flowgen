import "FlowGenPixelMarketplace"

// Script to get all listings from a specific seller
access(all) fun main(sellerAddress: Address): [FlowGenPixelMarketplace.ListingInfo] {
    let listingManager = getAccount(sellerAddress)
        .capabilities.borrow<&{FlowGenPixelMarketplace.ListingPublic}>(
            FlowGenPixelMarketplace.ListingPublicPath
        )
    
    if let manager = listingManager {
        return manager.getAllListings()
    }
    
    return []
}