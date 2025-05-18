import "NonFungibleToken"
import "MetadataViews"
import "FungibleToken"

access(all)
contract FlowGenAiImage: NonFungibleToken {

/// Standard Paths
  access(all) let CollectionStoragePath: StoragePath
  access(all) let CollectionPublicPath: PublicPath

  /// Path where the minter should be stored
  /// The standard paths for the collection are stored in the collection resource type
  access(all) let MinterStoragePath: StoragePath

  // --- Contract-Level Royalty Configuration ---
  access(all) let platformRoyaltyRate: UFix64
  access(all) let platformRoyaltyReceiverAddress: Address
  access(all) let creatorRoyaltyRate: UFix64
  // --- End Royalty Configuration ---

  access(all) resource NFT: NonFungibleToken.NFT {
    access(all) let id: UInt64
    access(all) let name: String
    access(all) let description: String
    access(all) let aiPrompt: String
    access(all) let ipfsImageCID: String
    access(all) let imageMediaType: String // e.g., "image/png", "image/jpeg"
    access(self) let royalties: [MetadataViews.Royalty]

    init(name: String, description: String, aiPrompt: String, ipfsImageCID: String, imageMediaType: String, royalties: [MetadataViews.Royalty]) {
      self.id = self.uuid
      self.name = name
      self.description = description
      self.aiPrompt = aiPrompt
      self.ipfsImageCID = ipfsImageCID
      self.imageMediaType = imageMediaType
      self.royalties = royalties
    }
    
    access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
      return <-FlowGenAiImage.createEmptyCollection(nftType: Type<@FlowGenAiImage.NFT>())
    }

    /// Gets a list of views specific to the individual NFT
    access(all) view fun getViews(): [Type] {
      return [
        Type<MetadataViews.Display>(),
        Type<MetadataViews.Editions>(),
        Type<MetadataViews.NFTCollectionData>(),
        Type<MetadataViews.NFTCollectionDisplay>(),
        Type<MetadataViews.Serial>(),
        Type<MetadataViews.Media>(),
        Type<MetadataViews.Royalties>()
      ]
    }

    /// Resolves a view for this specific NFT
    access(all) fun resolveView(_ view: Type): AnyStruct? {
      switch view {
        case Type<MetadataViews.Display>():
          let fullDescription = self.description.concat("\n\nAI Prompt:\n").concat(self.aiPrompt)
          let thumbnailUrl = "https://ipfs.io/ipfs/".concat(self.ipfsImageCID)
          return MetadataViews.Display(
            name: self.name,
            description: fullDescription,
            thumbnail: MetadataViews.HTTPFile(
              url: thumbnailUrl
            )
          )
        case Type<MetadataViews.Editions>():
          // There is no max number of NFTs that can be minted from this contract
          // so the max edition field value is set to nil
          let editionInfo = MetadataViews.Edition(name: "FlowGenAiImage Edition", number: self.id, max: nil)
          let editionList: [MetadataViews.Edition] = [editionInfo]
          return MetadataViews.Editions(
            editionList
          )
        case Type<MetadataViews.Serial>():
          return MetadataViews.Serial(
            self.id
          )
        case Type<MetadataViews.NFTCollectionData>():
          return FlowGenAiImage.resolveContractView(resourceType: Type<&FlowGenAiImage.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
        case Type<MetadataViews.NFTCollectionDisplay>():
          return FlowGenAiImage.resolveContractView(resourceType: Type<&FlowGenAiImage.NFT>(), viewType: Type<MetadataViews.NFTCollectionDisplay>())
        case Type<MetadataViews.Media>():
          let imageUrl = "https://ipfs.io/ipfs/".concat(self.ipfsImageCID)
          return MetadataViews.Media(
            file: MetadataViews.HTTPFile(url: imageUrl),
            mediaType: self.imageMediaType
          )
        case Type<MetadataViews.Royalties>():
          return MetadataViews.Royalties(self.royalties)
      }
      return nil
    }
  }

  access(all) resource Collection: NonFungibleToken.Collection {

    access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}}

    init() {
      self.ownedNFTs <- {}
    }

    access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
      return <-FlowGenAiImage.createEmptyCollection(nftType: Type<@FlowGenAiImage.NFT>())
    }
    /// deposit takes a NFT and adds it to the collections dictionary
    /// and adds the ID to the id array
    access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
      let token <- token as! @FlowGenAiImage.NFT
      let id = token.id

      // add the new token to the dictionary which removes the old one
      let oldToken <- self.ownedNFTs[token.id] <- token

      destroy oldToken
    }
    /// withdraw removes an NFT from the collection and moves it to the caller
    access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
      let token <- self.ownedNFTs.remove(key: withdrawID)
          ?? panic("FlowGenAiImage.Collection.withdraw: Could not withdraw an NFT with ID "
              .concat(withdrawID.toString())
              .concat(". Check the submitted ID to make sure it is one that this collection owns."))

      return <-token
    }

    
    /// getIDs returns an array of the IDs that are in the collection
    access(all) view fun getIDs(): [UInt64] {
      return self.ownedNFTs.keys
    }

    /// getSupportedNFTTypes returns a list of NFT types that this receiver accepts
    access(all) view fun getSupportedNFTTypes(): {Type: Bool} {
      let supportedTypes: {Type: Bool} = {}
      supportedTypes[Type<@FlowGenAiImage.NFT>()] = true
      return supportedTypes
    }

    /// Returns whether or not the given type is accepted by the collection
    /// A collection that can accept any type should just return true by default
    access(all) view fun isSupportedNFTType(type: Type): Bool {
      return type == Type<@FlowGenAiImage.NFT>()
    }
    // Allows a caller to borrow a reference to a specific NFT
    /// so that they can get the metadata views for the specific NFT
    access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
      return &self.ownedNFTs[id]
    }
  }
  access(all) resource NFTMinter {  
    access(all) fun createNFT(name: String, description: String, aiPrompt: String, ipfsImageCID: String, imageMediaType: String, creatorAddress: Address): @NFT {
      // Prepare platform royalty
      let platformReceiverCap: Capability<&{FungibleToken.Receiver}>? = getAccount(FlowGenAiImage.platformRoyaltyReceiverAddress)
          .capabilities.get<&{FungibleToken.Receiver}>(MetadataViews.getRoyaltyReceiverPublicPath())
      let unwrappedPlatformReceiverCap = platformReceiverCap ?? panic("Platform royalty receiver capability not found.")
      
      let platformRoyalty = MetadataViews.Royalty(
          receiver: unwrappedPlatformReceiverCap,
          cut: FlowGenAiImage.platformRoyaltyRate,
          description: "FlowGen Platform Royalty"
      )

      // Prepare creator royalty
      let creatorReceiverCap: Capability<&{FungibleToken.Receiver}>? = getAccount(creatorAddress)
          .capabilities.get<&{FungibleToken.Receiver}>(MetadataViews.getRoyaltyReceiverPublicPath())
      let unwrappedCreatorReceiverCap = creatorReceiverCap ?? panic("Creator royalty receiver capability not found.")
      
      let creatorRoyalty = MetadataViews.Royalty(
          receiver: unwrappedCreatorReceiverCap,
          cut: FlowGenAiImage.creatorRoyaltyRate,
          description: "Creator Royalty"
      )

      let royaltiesArray = [platformRoyalty, creatorRoyalty]

      return <-create NFT(name: name, description: description, aiPrompt: aiPrompt, ipfsImageCID: ipfsImageCID, imageMediaType: imageMediaType, royalties: royaltiesArray)
    }

    init() {
    }
  }

  init() {
    // Path initializations first
    self.CollectionStoragePath = /storage/flowGenAiImageNFTCollection
    self.CollectionPublicPath = /public/flowGenAiImageNFTCollection
    self.MinterStoragePath = /storage/flowGenAiImageNFTMinter
    
    // Initialize Royalty Configuration (replace with your actual values)
    self.platformRoyaltyRate = 0.025 // 2.5%
    self.platformRoyaltyReceiverAddress = 0xf8d6e0586b0a20c7 // Replace with FlowGen's actual address (e.g., your emulator-account's address)
    self.creatorRoyaltyRate = 0.05 // 5%

    self.account.storage.save(<- create NFTMinter(), to: self.MinterStoragePath)

  }

  access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
    return <- create Collection()
  }

  /// Gets a list of views for all the NFTs defined by this contract
  access(all) view fun getContractViews(resourceType: Type?): [Type] {
    return [
      Type<MetadataViews.NFTCollectionData>(),
      Type<MetadataViews.NFTCollectionDisplay>()
    ]
  }

  /// Resolves a view that applies to all the NFTs defined by this contract
  access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
    switch viewType {
      case Type<MetadataViews.NFTCollectionData>():
        let collectionData = MetadataViews.NFTCollectionData(
          storagePath: self.CollectionStoragePath,
          publicPath: self.CollectionPublicPath,
          publicCollection: Type<&FlowGenAiImage.Collection>(),
          publicLinkedType: Type<&FlowGenAiImage.Collection>(),
          createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
            return <-FlowGenAiImage.createEmptyCollection(nftType: Type<@FlowGenAiImage.NFT>())
          })
        )
        return collectionData
      case Type<MetadataViews.NFTCollectionDisplay>():
        let media: MetadataViews.Media = MetadataViews.Media(
          file: MetadataViews.HTTPFile(
            url: "https://ipfs.io/ipfs/bafkreif6666666666666666666666666666666666666666666666666666666666666666"
          ),
          mediaType: "image/png"
        )
        return MetadataViews.NFTCollectionDisplay(
            name: "The FlowGenAiImage Collection",
          description: "This collection is for images generated by the FlowGenAiImage contract.",
          externalURL: MetadataViews.ExternalURL("Add your own link here"),
          squareImage: media,
          bannerImage: media,
          socials: {
            "twitter": MetadataViews.ExternalURL("Add a link to your project's twitter")
          }
        )
    }
    return nil
  }

  // --- Public Minting Function ---
  access(all) fun publicMintAiImageNFT(
      recipientCollection: &{NonFungibleToken.Receiver},
      name: String, 
      description: String, 
      aiPrompt: String, 
      ipfsImageCID: String, 
      imageMediaType: String, 
      creatorAddress: Address
  ): @NFT {
      let minter = self.account.storage.borrow<&NFTMinter>(from: self.MinterStoragePath)
          ?? panic("Could not borrow NFTMinter from contract storage")
      
      let newNFT <- minter.createNFT(
          name: name, 
          description: description, 
          aiPrompt: aiPrompt, 
          ipfsImageCID: ipfsImageCID, 
          imageMediaType: imageMediaType, 
          creatorAddress: creatorAddress
      )
      // The deposit is now handled by the caller (transaction) which has the recipientCollection reference
      // recipientCollection.deposit(token: <-newNFT) // This line is removed from here
      return <-newNFT // Return the NFT to be deposited by the transaction
  }
  // --- End Public Minting Function ---

}