import "NonFungibleToken" // For NFT interfaces
import "ViewResolver"       // For Resolver interface
import "MetadataViews"     // For Display and other views
import "CanvasBackground" // Your specific contract
import "FlowGenPixel"

// Struct for the return type remains useful
access(all) struct LatestBackgroundInfo {
    access(all) let id: UInt64
    access(all) let imageHash: String
    access(all) let versionNumber: UInt64
    access(all) let name: String?
    access(all) let description: String?

    init(id: UInt64, imageHash: String, versionNumber: UInt64, name: String?, description: String?) {
        self.id = id
        self.imageHash = imageHash
        self.versionNumber = versionNumber
        self.name = name
        self.description = description
    }
}

// This script fetches the imageHash and version number of the latest background NFT.
access(all) fun main(ownerAddress: Address): LatestBackgroundInfo? {
    let latestID = CanvasBackground.latestBackgroundNftID
    if latestID == nil {
        log("CanvasBackground.latestBackgroundNftID is nil.")
        return nil
    }

    // Get the public capability for the owner's CanvasBackground collection
    // The type for the capability should be the concrete &CanvasBackground.Collection
    // if it correctly implements the interfaces needed (like NonFungibleToken.CollectionPublic and ViewResolver.ResolverCollection)
    let collectionCap = getAccount(ownerAddress)
        .capabilities.get<&CanvasBackground.Collection>( 
            CanvasBackground.CollectionPublicPath
        )
    
    if !collectionCap.check() {
        log("Could not borrow collection capability from owner: ".concat(ownerAddress.toString()).concat(" at path: ").concat(CanvasBackground.CollectionPublicPath.toString()))
        return nil
    }

    let collectionRef = collectionCap.borrow()
        ?? panic("Failed to borrow reference from collection capability.")

    // Borrow the NFT. The standard NonFungibleToken.Collection.borrowNFT takes the id without a label.
    let nft = collectionRef.borrowNFT(latestID!) 
        ?? panic("NFT with ID ".concat(latestID!.toString()).concat(" not found in owner's collection."))

    // We expect the collection to hold concrete CanvasBackground.NFT types.
    // Cast to the concrete NFT type to access specific fields like imageHash and versionNumber.
    let bgNFT = nft as! &CanvasBackground.NFT // This cast is crucial.

    // Attempt to resolve Display view for name and description (optional)
    var displayName: String? = nil
    var displayDescription: String? = nil

    // The NFT resource itself (CanvasBackground.NFT) implements ViewResolver.Resolver.
    if let display = bgNFT.resolveView(Type<MetadataViews.Display>()) as? MetadataViews.Display {
        displayName = display.name
        displayDescription = display.description
    } else {
        log("Could not resolve Display view for NFT ID: ".concat(latestID!.toString()))
    }
    
    return LatestBackgroundInfo(
        id: bgNFT.id,
        imageHash: bgNFT.imageHash,
        versionNumber: bgNFT.versionNumber,
        name: displayName,
        description: displayDescription
    )
} 