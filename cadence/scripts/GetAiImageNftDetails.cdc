import "NonFungibleToken"
import "MetadataViews"
import "FlowGenAiImage"

// Script: get_ai_image_nft_details.cdc
// Description: Fetches details for a specific FlowGenAiImage.NFT given its owner and ID.
//
// Arguments:
// - ownerAddress: Address, the address of the account that owns the NFT.
// - nftID: UInt64, the ID of the FlowGenAiImage.NFT to fetch details for.
//
// Returns: A struct containing the NFT's details, or nil if not found or not accessible.

access(all) struct AIImageDetails {
    access(all) let id: UInt64
    access(all) let name: String
    access(all) let description: String
    access(all) let aiPrompt: String
    access(all) let ipfsImageCID: String
    access(all) let imageMediaType: String
    access(all) let displayView: MetadataViews.Display?
    access(all) let mediaView: MetadataViews.Media?
    // Add other fields or views as needed, e.g., royalties if desired

    init(
        id: UInt64, 
        name: String, 
        description: String, 
        aiPrompt: String, 
        ipfsImageCID: String, 
        imageMediaType: String,
        displayView: MetadataViews.Display?,
        mediaView: MetadataViews.Media?
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.aiPrompt = aiPrompt
        self.ipfsImageCID = ipfsImageCID
        self.imageMediaType = imageMediaType
        self.displayView = displayView
        self.mediaView = mediaView
    }
}

access(all) fun main(ownerAddress: Address, nftID: UInt64): AIImageDetails? {
    log("Script: get_ai_image_nft_details.cdc - Fetching details for NFT ID: ".concat(nftID.toString()).concat(" owned by: ").concat(ownerAddress.toString()))

    let account = getAccount(ownerAddress)

    // Get the capability to the concrete collection type
    let collectionCap = account.capabilities.get<&FlowGenAiImage.Collection>(
        FlowGenAiImage.CollectionPublicPath
    )

    if !collectionCap.check() {
        log("Error: Public capability for FlowGenAiImage.Collection not found or is not valid for owner: ".concat(ownerAddress.toString()))
        return nil
    }

    // Borrow the concrete collection type reference
    let collectionRef: &FlowGenAiImage.Collection = collectionCap.borrow()
        ?? panic("Could not borrow a reference to the FlowGenAiImage.Collection.")

    // Try to borrow the concrete NFT type using methods available on FlowGenAiImage.Collection
    // (assuming FlowGenAiImage.Collection implements AIImageNFTCollectionPublic which has borrowAIImageNFT)
    let nftRef: &FlowGenAiImage.NFT? = collectionRef.borrowAIImageNFT(id: nftID)

    if nftRef == nil {
        log("Error: FlowGenAiImage.NFT with ID ".concat(nftID.toString()).concat(" not found in collection for owner: ").concat(ownerAddress.toString()))
        return nil
    }
    
    let unwrappedNftRef = nftRef!

    // Resolve standard views using methods available on FlowGenAiImage.Collection
    // (assuming FlowGenAiImage.Collection implements MetadataViews.ResolverCollection which has borrowViewResolver)
    var displayView: MetadataViews.Display? = nil
    let displayResolverRef = collectionRef.borrowViewResolver(id: nftID)
    let resolvedDisplayView = displayResolverRef?.resolveView(Type<MetadataViews.Display>()) 
    if resolvedDisplayView != nil {
        displayView = resolvedDisplayView as! MetadataViews.Display? 
    }

    var mediaView: MetadataViews.Media? = nil
    let mediaResolverRef = collectionRef.borrowViewResolver(id: nftID)
    let resolvedMediaStruct = mediaResolverRef?.resolveView(Type<MetadataViews.Media>())
    if resolvedMediaStruct != nil {
        mediaView = resolvedMediaStruct as! MetadataViews.Media?
    }

    return AIImageDetails(
        id: unwrappedNftRef.id,
        name: unwrappedNftRef.name,
        description: unwrappedNftRef.description,
        aiPrompt: unwrappedNftRef.aiPrompt,
        ipfsImageCID: unwrappedNftRef.ipfsImageCID,
        imageMediaType: unwrappedNftRef.imageMediaType,
        displayView: displayView,
        mediaView: mediaView
    )
} 