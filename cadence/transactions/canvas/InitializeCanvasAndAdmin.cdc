// cadence/transactions/canvas/InitializeCanvasAndAdmin.cdc
import "NonFungibleToken"
import "ViewResolver" 
import "CanvasBackground"

// initialImageHash: String. If empty string "" or "_SKIP_MINT_", minting is skipped.
transaction(initialImageHash: String) { 

    prepare(signer: auth(Storage, Capabilities) &Account) {
        let collectionStoragePath = CanvasBackground.CollectionStoragePath
        let collectionPublicPath = CanvasBackground.CollectionPublicPath

        // --- Part 1: Setup Admin's Collection (from setup_admin_canvas_collection.cdc logic) ---
        if signer.storage.borrow<&CanvasBackground.Collection>(from: collectionStoragePath) == nil {
            let collection <- CanvasBackground.createEmptyCollection(nftType: Type<@CanvasBackground.NFT>())
            signer.storage.save(<-collection, to: collectionStoragePath)
            log("Admin Account: CanvasBackground.Collection created and saved to ".concat(collectionStoragePath.toString()))
        } else {
            log("Admin Account: CanvasBackground.Collection already exists at ".concat(collectionStoragePath.toString()))
        }

        let existingCap = signer.capabilities.get<&CanvasBackground.Collection>(collectionPublicPath)
        if !existingCap.check() {
            // Unpublish any existing capability at the path first to ensure clean state.
            signer.capabilities.unpublish(collectionPublicPath)
            log("Admin Account: Unlinked any existing capability at ".concat(collectionPublicPath.toString()))
            
            let newCollectionCap = signer.capabilities.storage.issue<&CanvasBackground.Collection>(collectionStoragePath)
            signer.capabilities.publish(newCollectionCap, at: collectionPublicPath)
            log("Admin Account: Published new public capability for &CanvasBackground.Collection to ".concat(collectionPublicPath.toString()))
        } else {
            log("Admin Account: Correct public capability for &CanvasBackground.Collection already exists at ".concat(collectionPublicPath.toString()))
        }

        // --- Part 2: Conditionally Mint an Initial Background NFT --- 
        if initialImageHash != "" && initialImageHash != "_SKIP_MINT_" { // Check against empty or magic string
            let adminRef = signer.storage.borrow<&CanvasBackground.Admin>(from: CanvasBackground.AdminStoragePath)
                ?? panic("Could not borrow Admin resource from signer. Ensure CanvasBackground contract is deployed and initialized by this account, or admin resource is accessible.")
            
            let collectionRef = signer.storage.borrow<&CanvasBackground.Collection>(from: collectionStoragePath)
                ?? panic("Collection should exist and be borrowed by now, but failed.")

            if CanvasBackground.latestBackgroundNftID == nil {
                log("Minting initial background NFT with hash: ".concat(initialImageHash))
                let newNFT <- adminRef.mintNewBackground(
                    imageHash: initialImageHash, // No longer needs ! because it's String
                    triggeringPixelID: nil,
                    triggeringEventTransactionID: nil,
                    triggeringAiImageID: nil
                )
                let newNftId = newNFT.id // Get ID before moving the resource
                log("Minted new NFT with ID for deposit: ".concat(newNftId.toString()))
                
                collectionRef.deposit(token: <-newNFT)
                log("Attempted deposit of NFT ID: ".concat(newNftId.toString()))

                // Debug: Immediately try to borrow back from the same collectionRef
                let borrowedNftForDebug = collectionRef.borrowNFT(newNftId) // Assuming borrowNFT has no label for id
                if borrowedNftForDebug == nil {
                    log("DEBUG: NFT ID ".concat(newNftId.toString()).concat(" IS NIL immediately after deposit in this transaction. This is the core issue."))
                } else {
                    log("DEBUG: NFT ID ".concat(newNftId.toString()).concat(" was successfully borrowed back from collectionRef immediately after deposit."))
                }
            } else {
                log("Skipping initial mint as CanvasBackground.latestBackgroundNftID is already set (".concat(CanvasBackground.latestBackgroundNftID!.toString()).concat(")."))
            }
        } else {
            log("Skipping initial mint due to initialImageHash value ('".concat(initialImageHash).concat("')."))
        }
    }

    execute {
        log("Canvas and Admin initialization transaction completed.")
    }
} 