import "FooBar"
// import "NonFungibleToken" // Standard, aliased by flow.json
import FlowGenPixel from "FlowGenPixel" // Changed to named import
// NonFungibleToken import might not be needed if FlowGenPixel contract already defines necessary paths/types from it.
// However, explicit import of standard contracts is often good practice if using their types directly.
// import NonFungibleToken from "NonFungibleToken" // Assuming flow.json handles this alias

transaction {

    prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, SaveValue, UnpublishCapability) &Account) {

        // Check if the account already has a FlowGenPixel Collection
        if signer.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath) != nil {
            log("Account already has a FlowGenPixel Collection.")
            return
        }

        // Create a new empty FlowGenPixel Collection and store it in account storage
        let collection <- FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
        signer.storage.save(<-collection, to: FlowGenPixel.CollectionStoragePath)
        log("FlowGenPixel Collection created and saved.")

        // Create a public capability for the Collection.
        // Publishing a capability to the concrete &FlowGenPixel.Collection type, 
        // similar to how FooBar.cdc's NFTCollectionData view defines its publicCollection type.
        let publicCapability = signer.capabilities.storage.issue<&FlowGenPixel.Collection>(
            FlowGenPixel.CollectionStoragePath
        )
        signer.capabilities.publish(publicCapability, at: FlowGenPixel.CollectionPublicPath)
        log("Published public capability for FlowGenPixel Collection.")
    }
}
