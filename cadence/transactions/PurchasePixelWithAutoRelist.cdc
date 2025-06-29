import "FlowGenPixel"
import "FlowGenPixelMarketplace"
import "FlowGenAiImage"
import "NonFungibleToken"
import "FungibleToken"
import "FlowToken"

// Combined transaction to purchase a pixel (either primary or secondary sale) 
// and automatically relist it for sale unless opted out
transaction(
    x: UInt16, 
    y: UInt16, 
    aiImageNftID: UInt64,  // Only used for primary sales
    sellerAddress: Address?, // nil for primary sales
    autoRelist: Bool // whether to automatically relist the pixel
) {
    let buyerAddress: Address
    let paymentVault: @{FungibleToken.Vault}
    let buyerPixelCollection: &{NonFungibleToken.Collection}
    let buyerAiImageCollection: &{NonFungibleToken.Collection}
    let pixelId: UInt64?
    let isPrimarySale: Bool
    let purchasePrice: UFix64
    let listingManager: &FlowGenPixelMarketplace.ListingManager?
    
    prepare(buyer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, SaveValue) &Account) {
        self.buyerAddress = buyer.address
        
        // Setup pixel collection if needed
        if buyer.storage.borrow<&{NonFungibleToken.Collection}>(from: FlowGenPixel.CollectionStoragePath) == nil {
            let collection <- FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
            buyer.storage.save(<-collection, to: FlowGenPixel.CollectionStoragePath)
            
            let collectionCap = buyer.capabilities.storage.issue<&{NonFungibleToken.Collection}>(
                FlowGenPixel.CollectionStoragePath
            )
            buyer.capabilities.publish(collectionCap, at: FlowGenPixel.CollectionPublicPath)
        }
        
        // Borrow pixel collection
        self.buyerPixelCollection = buyer.storage.borrow<&{NonFungibleToken.Collection}>(
            from: FlowGenPixel.CollectionStoragePath
        ) ?? panic("Could not borrow pixel collection")
        
        // Borrow AI image collection for validation
        self.buyerAiImageCollection = buyer.storage.borrow<&{NonFungibleToken.Collection}>(
            from: FlowGenAiImage.CollectionStoragePath
        ) ?? panic("Could not borrow AI image collection. Please set up your AI image collection first.")
        
        // Check if pixel exists (secondary sale) or not (primary sale)
        self.pixelId = FlowGenPixel.getPixelNFTID(x: x, y: y)
        self.isPrimarySale = self.pixelId == nil
        
        if self.isPrimarySale {
            // Primary sale - get price from contract
            self.purchasePrice = FlowGenPixel.getCurrentPixelPrice(x: x, y: y)
            
            // Verify buyer owns the AI image they want to display
            let aiImageNFT = self.buyerAiImageCollection.borrowNFT(aiImageNftID)
                ?? panic("You don't own the AI image NFT with ID ".concat(aiImageNftID.toString()))
        } else {
            // Secondary sale - get listing info
            if sellerAddress == nil {
                panic("Seller address required for secondary sales")
            }
            
            let listingRef = getAccount(sellerAddress!)
                .capabilities.borrow<&{FlowGenPixelMarketplace.ListingPublic}>(
                    FlowGenPixelMarketplace.ListingPublicPath
                ) ?? panic("Could not borrow seller's listing manager")
            
            let listingInfo = listingRef.getListingInfo(pixelId: self.pixelId!)
                ?? panic("Pixel is not listed for sale by this seller")
            
            self.purchasePrice = listingInfo.price
        }
        
        // Withdraw payment
        let flowVault = buyer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow Flow token vault")
        
        self.paymentVault <- flowVault.withdraw(amount: self.purchasePrice)
        
        // Setup listing manager if auto-relisting
        if autoRelist {
            if buyer.storage.borrow<&FlowGenPixelMarketplace.ListingManager>(from: FlowGenPixelMarketplace.ListingStoragePath) == nil {
                // Create collection capability for the listing manager
                let collectionCap = buyer.capabilities.storage.issue<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(
                    FlowGenPixel.CollectionStoragePath
                )
                
                // Create and save a new listing manager
                let listingManager <- FlowGenPixelMarketplace.createListingManager(collectionCap: collectionCap)
                buyer.storage.save(<-listingManager, to: FlowGenPixelMarketplace.ListingStoragePath)
                
                // Create public capability
                let listingCap = buyer.capabilities.storage.issue<&{FlowGenPixelMarketplace.ListingPublic}>(
                    FlowGenPixelMarketplace.ListingStoragePath
                )
                buyer.capabilities.publish(listingCap, at: FlowGenPixelMarketplace.ListingPublicPath)
            }
            
            self.listingManager = buyer.storage.borrow<&FlowGenPixelMarketplace.ListingManager>(
                from: FlowGenPixelMarketplace.ListingStoragePath
            )
        } else {
            self.listingManager = nil
        }
    }
    
    execute {
        var newPixelId: UInt64 = 0
        
        if self.isPrimarySale {
            // Primary sale - mint new pixel
            let newPixel <- FlowGenPixel.publicMintPixelNFT(
                x: x,
                y: y,
                aiImageNftID: aiImageNftID,
                payment: <-self.paymentVault
            )
            newPixelId = newPixel.id
            self.buyerPixelCollection.deposit(token: <-newPixel)
            
            log("Successfully purchased new pixel at (".concat(x.toString()).concat(", ").concat(y.toString()).concat(") for ").concat(self.purchasePrice.toString()).concat(" FLOW"))
        } else {
            // Secondary sale - buy from marketplace
            let listingRef = getAccount(sellerAddress!)
                .capabilities.borrow<&{FlowGenPixelMarketplace.ListingPublic}>(
                    FlowGenPixelMarketplace.ListingPublicPath
                ) ?? panic("Could not borrow seller's listing manager")
            
            newPixelId = self.pixelId!
            
            listingRef.purchasePixel(
                pixelId: self.pixelId!,
                payment: <-self.paymentVault,
                buyerCollection: self.buyerPixelCollection
            )
            
            log("Successfully purchased pixel #".concat(self.pixelId!.toString()).concat(" for ").concat(self.purchasePrice.toString()).concat(" FLOW"))
        }
        
        // Auto-relist if requested
        if autoRelist && self.listingManager != nil {
            self.listingManager!.listPixelForSale(
                pixelId: newPixelId,
                originalPurchasePrice: self.purchasePrice
            )
            
            let relistPrice = self.purchasePrice * 1.25
            log("Pixel automatically relisted for sale at ".concat(relistPrice.toString()).concat(" FLOW (25% markup)"))
        }
    }
}