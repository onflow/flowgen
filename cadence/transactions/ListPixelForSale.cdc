import "FlowGenPixelMarketplace"
import "FlowGenPixel"
import "NonFungibleToken"

// Transaction to list a pixel for sale with automatic 25% markup
transaction(pixelId: UInt64, originalPurchasePrice: UFix64) {
    let listingManager: &FlowGenPixelMarketplace.ListingManager
    let pixelCollection: &{NonFungibleToken.Collection}
    
    prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, SaveValue) &Account) {
        // Check if the signer has a listing manager
        if signer.storage.borrow<&FlowGenPixelMarketplace.ListingManager>(from: FlowGenPixelMarketplace.ListingStoragePath) == nil {
            // Create collection capability for the listing manager
            let collectionCap = signer.capabilities.storage.issue<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(
                FlowGenPixel.CollectionStoragePath
            )
            
            // Create and save a new listing manager
            let listingManager <- FlowGenPixelMarketplace.createListingManager(collectionCap: collectionCap)
            signer.storage.save(<-listingManager, to: FlowGenPixelMarketplace.ListingStoragePath)
            
            // Create public capability
            let listingCap = signer.capabilities.storage.issue<&{FlowGenPixelMarketplace.ListingPublic}>(
                FlowGenPixelMarketplace.ListingStoragePath
            )
            signer.capabilities.publish(listingCap, at: FlowGenPixelMarketplace.ListingPublicPath)
        }
        
        // Borrow the listing manager
        self.listingManager = signer.storage.borrow<&FlowGenPixelMarketplace.ListingManager>(
            from: FlowGenPixelMarketplace.ListingStoragePath
        ) ?? panic("Could not borrow ListingManager")
        
        // Borrow pixel collection to verify ownership
        self.pixelCollection = signer.storage.borrow<&{NonFungibleToken.Collection}>(
            from: FlowGenPixel.CollectionStoragePath
        ) ?? panic("Could not borrow pixel collection")
    }
    
    execute {
        // Verify the signer owns the pixel
        let nft = self.pixelCollection.borrowNFT(pixelId)
            ?? panic("Pixel NFT with ID ".concat(pixelId.toString()).concat(" not found in your collection"))
        
        // List the pixel for sale with automatic 25% markup
        self.listingManager.listPixelForSale(
            pixelId: pixelId,
            originalPurchasePrice: originalPurchasePrice
        )
        
        let salePrice = originalPurchasePrice * 1.25
        log("Pixel ".concat(pixelId.toString()).concat(" listed for sale at ").concat(salePrice.toString()).concat(" FLOW (25% markup from original price of ").concat(originalPurchasePrice.toString()).concat(" FLOW)"))
    }
}