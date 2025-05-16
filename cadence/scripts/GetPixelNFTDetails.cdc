import NonFungibleToken from "NonFungibleToken"
import FlowGenPixel from "FlowGenPixel"
import MetadataViews from "MetadataViews"

access(all) struct PixelNFTDetails {
    access(all) let id: UInt64
    access(all) let name: String
    access(all) let description: String
    access(all) let thumbnailURL: String
    access(all) let aiPrompt: String
    access(all) let imageURI: String
    access(all) let pixelArtURI: String
    access(all) let imageHash: String
    access(all) let x: UInt16
    access(all) let y: UInt16
    access(all) let displayView: MetadataViews.Display?

    init(
        id: UInt64, name: String, description: String, thumbnailURL: String,
        aiPrompt: String, imageURI: String, pixelArtURI: String, imageHash: String,
        x: UInt16, y: UInt16, displayView: MetadataViews.Display?
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.thumbnailURL = thumbnailURL
        self.aiPrompt = aiPrompt
        self.imageURI = imageURI
        self.pixelArtURI = pixelArtURI
        self.imageHash = imageHash
        self.x = x
        self.y = y
        self.displayView = displayView
    }
}

access(all) fun main(ownerAddress: Address, nftID: UInt64): PixelNFTDetails? {
    let account = getAccount(ownerAddress)

    let collectionCap = account.capabilities.get<&{NonFungibleToken.CollectionPublic}>(
        FlowGenPixel.CollectionPublicPath
    )
    
    let collectionRef = collectionCap.borrow()
    if collectionRef == nil {
        log("Could not borrow CollectionPublic capability from account ".concat(ownerAddress.toString()))
        return nil
    }

    let nftRefGeneric = collectionRef!.borrowNFT(nftID)
    if nftRefGeneric == nil {
        log("Could not borrow NFT with ID ".concat(nftID.toString()).concat(" from owner ").concat(ownerAddress.toString()))
        return nil
    }

    let nftRef = nftRefGeneric! as? &FlowGenPixel.NFT
    if nftRef == nil {
        log("Borrowed NFT is not of expected type FlowGenPixel.NFT")
        return nil
    }
    
    var displayView: MetadataViews.Display? = nil
    let resolvedView = nftRef!.resolveView(Type<MetadataViews.Display>())
    if resolvedView != nil {
        displayView = resolvedView! as? MetadataViews.Display
    }

    return PixelNFTDetails(
        id: nftRef!.id,
        name: nftRef!.name,
        description: nftRef!.description,
        thumbnailURL: nftRef!.thumbnail.url,
        aiPrompt: nftRef!.aiPrompt,
        imageURI: nftRef!.imageURI,
        pixelArtURI: nftRef!.pixelArtURI,
        imageHash: nftRef!.imageHash,
        x: nftRef!.x,
        y: nftRef!.y,
        displayView: displayView
    )
} 