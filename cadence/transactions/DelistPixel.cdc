import "FlowGenPixelMarketplace"

// Transaction to remove a pixel from sale
transaction(pixelId: UInt64) {
    let listingManager: &FlowGenPixelMarketplace.ListingManager
    
    prepare(signer: auth(BorrowValue) &Account) {
        // Borrow the listing manager
        self.listingManager = signer.storage.borrow<&FlowGenPixelMarketplace.ListingManager>(
            from: FlowGenPixelMarketplace.ListingStoragePath
        ) ?? panic("Could not borrow ListingManager. Have you listed any pixels for sale?")
    }
    
    execute {
        // Delist the pixel
        self.listingManager.delistPixel(pixelId: pixelId)
        
        log("Pixel ".concat(pixelId.toString()).concat(" has been removed from sale"))
    }
}