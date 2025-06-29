import "FlowGenPixelMarketplace"
import "FlowGenPixel"
import "NonFungibleToken"
import "FungibleToken"
import "FlowToken"

// Transaction to purchase a pixel listed on the marketplace
transaction(sellerAddress: Address, pixelId: UInt64) {
    let paymentVault: @{FungibleToken.Vault}
    let buyerCollection: &{NonFungibleToken.Collection}
    let listingRef: &{FlowGenPixelMarketplace.ListingPublic}
    let listingInfo: FlowGenPixelMarketplace.ListingInfo
    
    prepare(buyer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, SaveValue) &Account) {
        // Setup pixel collection if needed
        if buyer.storage.borrow<&{NonFungibleToken.Collection}>(from: FlowGenPixel.CollectionStoragePath) == nil {
            let collection <- FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
            buyer.storage.save(<-collection, to: FlowGenPixel.CollectionStoragePath)
            
            let collectionCap = buyer.capabilities.storage.issue<&{NonFungibleToken.Collection}>(
                FlowGenPixel.CollectionStoragePath
            )
            buyer.capabilities.publish(collectionCap, at: FlowGenPixel.CollectionPublicPath)
        }
        
        // Borrow buyer's pixel collection
        self.buyerCollection = buyer.storage.borrow<&{NonFungibleToken.Collection}>(
            from: FlowGenPixel.CollectionStoragePath
        ) ?? panic("Could not borrow buyer's pixel collection")
        
        // Get seller's listing manager
        self.listingRef = getAccount(sellerAddress)
            .capabilities.borrow<&{FlowGenPixelMarketplace.ListingPublic}>(
                FlowGenPixelMarketplace.ListingPublicPath
            ) ?? panic("Could not borrow seller's listing manager")
        
        // Get listing info to check price
        self.listingInfo = self.listingRef.getListingInfo(pixelId: pixelId)
            ?? panic("Pixel ".concat(pixelId.toString()).concat(" is not listed for sale by this seller"))
        
        // Withdraw payment
        let flowVault = buyer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow Flow token vault")
        
        self.paymentVault <- flowVault.withdraw(amount: self.listingInfo.price)
    }
    
    execute {
        // Purchase the pixel
        self.listingRef.purchasePixel(
            pixelId: pixelId,
            payment: <-self.paymentVault,
            buyerCollection: self.buyerCollection
        )
        
        log("Successfully purchased pixel ".concat(pixelId.toString()).concat(" for ").concat(self.listingInfo.price.toString()).concat(" FLOW"))
        log("Original price was ".concat(self.listingInfo.originalPurchasePrice.toString()).concat(" FLOW (25% markup applied)"))
    }
}