// cadence/transactions/canvas/setup_admin_canvas_collection.cdc
import NonFungibleToken from "NonFungibleToken"
import ViewResolver from "ViewResolver" 
import CanvasBackground from "CanvasBackground"

transaction {
    prepare(signer: auth(Storage, Capabilities) &Account) {
        let collectionStoragePath = CanvasBackground.CollectionStoragePath
        let collectionPublicPath = CanvasBackground.CollectionPublicPath

        // 1. Ensure the collection resource exists at the storage path
        if signer.storage.borrow<&CanvasBackground.Collection>(from: collectionStoragePath) == nil {
            let collection <- CanvasBackground.createEmptyCollection(nftType: Type<@CanvasBackground.NFT>())
            signer.storage.save(<-collection, to: collectionStoragePath)
            log("Admin Account: CanvasBackground.Collection created and saved to ".concat(collectionStoragePath.toString()))
        } else {
            log("Admin Account: CanvasBackground.Collection already exists at ".concat(collectionStoragePath.toString()))
        }

        // 2. Ensure the correct public capability is published.
        let desiredCapType = Type<&CanvasBackground.Collection>() // The type we want to publish and check for

        // Check if a capability of the desired type already exists and is valid.
        let existingCap = signer.capabilities.get<&CanvasBackground.Collection>(collectionPublicPath) // Check specifically for our desired type
        
        if existingCap.check() {
            log("Admin Account: Correct public capability (&CanvasBackground.Collection) already exists at ".concat(collectionPublicPath.toString()).concat(" and is valid."))
        } else {
            log("Admin Account: Public capability at ".concat(collectionPublicPath.toString()).concat(" is missing or not of the exact desired type (&CanvasBackground.Collection). Attempting to (re-)publish."))
            
            // Unpublish any existing capability at the path first to avoid conflict.
            signer.capabilities.unpublish(collectionPublicPath)
            log("Admin Account: Unlinked any existing capability at ".concat(collectionPublicPath.toString()))
            
            // Issue and publish the new capability to the concrete &CanvasBackground.Collection type
            let newCollectionCap = signer.capabilities.storage.issue<&CanvasBackground.Collection>(collectionStoragePath)
            signer.capabilities.publish(newCollectionCap, at: collectionPublicPath)
            log("Admin Account: Published new public capability of type &CanvasBackground.Collection to ".concat(collectionPublicPath.toString()))
            
            // Final check
            if signer.capabilities.get<&CanvasBackground.Collection>(collectionPublicPath).check() {
                log("Admin Account: Successfully verified newly published &CanvasBackground.Collection capability.")
            } else {
                log("Admin Account: FAILED to verify newly published &CanvasBackground.Collection capability. This is unexpected.")
            }
        }
    }

    execute {
        log("Admin account setup transaction for CanvasBackground collection completed (or verified).")
    }
} 