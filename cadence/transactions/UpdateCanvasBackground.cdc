import "NonFungibleToken"
import "CanvasBackground"

// Cadence 1.0: Import necessary entitlements if they are not built-in
// For Storage, Capabilities, etc. they are usually built-in with `auth()`

transaction(imageHash: String, triggeringPixelID: UInt64?, triggeringEventTransactionID: String?, triggeringAiImageID: UInt64?) {
    
    let adminRef: &CanvasBackground.Admin
    let collectionRef: &CanvasBackground.Collection

    // Requesting Storage and Capabilities entitlements for the signer
    prepare(signer: auth(Storage, Capabilities) &Account) { 
        // Borrow Admin Resource
        self.adminRef = signer.storage.borrow<&CanvasBackground.Admin>(from: CanvasBackground.AdminStoragePath)
            ?? panic("Could not borrow Admin resource from signer's account")

        // Ensure Collection exists and borrow a reference
        if signer.storage.borrow<&CanvasBackground.Collection>(from: CanvasBackground.CollectionStoragePath) == nil {
            // Create and save a new empty Collection for the admin account
            let collection <- CanvasBackground.createEmptyCollection(nftType: Type<@CanvasBackground.NFT>())
            signer.storage.save(<-collection, to: CanvasBackground.CollectionStoragePath)
            
            // Publish a public capability to the Collection if it doesn't exist
            // This makes it possible to view the admin's collection publicly if desired
            if signer.capabilities.get<&{NonFungibleToken.CollectionPublic}>(CanvasBackground.CollectionPublicPath).borrow() == nil {
                 signer.capabilities.publish(
                    signer.capabilities.storage.issue<&CanvasBackground.Collection>(CanvasBackground.CollectionStoragePath),
                    at: CanvasBackground.CollectionPublicPath
                )
            }
        }
        
        self.collectionRef = signer.storage.borrow<&CanvasBackground.Collection>(from: CanvasBackground.CollectionStoragePath)
            ?? panic("Could not borrow Collection reference from signer's account")
    }

    execute {
        let newNFT <- self.adminRef.mintNewBackground(
            imageHash: imageHash,
            triggeringPixelID: triggeringPixelID,
            triggeringEventTransactionID: triggeringEventTransactionID,
            triggeringAiImageID: triggeringAiImageID
        )
        
        let nftId = newNFT.id
        self.collectionRef.deposit(token: <-newNFT)
        
        log("Admin minted and deposited new CanvasBackground NFT. ID: ".concat(nftId.toString()).concat(", ImageHash: ").concat(imageHash))
    }
} 