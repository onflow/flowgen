import "FooBar"
import "NonFungibleToken"

transaction {

    prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, SaveValue, UnpublishCapability) &Account) {

        // Return early if the account already has a collection
        if signer.storage.borrow<&FooBar.Collection>(from: FooBar.CollectionStoragePath) != nil {
            return
        }

        // Create a new empty collection
        let collection <- FooBar.createEmptyCollection(nftType: Type<@FooBar.NFT>())

        // save it to the account
        signer.storage.save(<-collection, to: FooBar.CollectionStoragePath)

        let collectionCap = signer.capabilities.storage.issue<&FooBar.Collection>(FooBar.CollectionStoragePath)
        signer.capabilities.publish(collectionCap, at: FooBar.CollectionPublicPath)
    }
}
