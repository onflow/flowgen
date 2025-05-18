import "NonFungibleToken"
import "MetadataViews"

access(all)
contract FooBar: NonFungibleToken {

/// Standard Paths
  access(all) let CollectionStoragePath: StoragePath
  access(all) let CollectionPublicPath: PublicPath

  /// Path where the minter should be stored
  /// The standard paths for the collection are stored in the collection resource type
  access(all) let MinterStoragePath: StoragePath

  access(all) resource NFT: NonFungibleToken.NFT {
    access(all) let id: UInt64

    init() {
      self.id = self.uuid
    }
    
    access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
      return <-FooBar.createEmptyCollection(nftType: Type<@FooBar.NFT>())
    }

    /// Gets a list of views specific to the individual NFT
    access(all) view fun getViews(): [Type] {
      return [
        Type<MetadataViews.Display>(),
        Type<MetadataViews.Editions>(),
        Type<MetadataViews.NFTCollectionData>(),
        Type<MetadataViews.NFTCollectionDisplay>(),
        Type<MetadataViews.Serial>()
      ]
    }

    /// Resolves a view for this specific NFT
    access(all) fun resolveView(_ view: Type): AnyStruct? {
      switch view {
        case Type<MetadataViews.Display>():
          return MetadataViews.Display(
            name: "FooBar Example Token",
            description: "An Example NFT Contract from the Flow NFT Guide",
            thumbnail: MetadataViews.HTTPFile(
              url: "Fill this in with a URL to a thumbnail of the NFT"
            )
          )
        case Type<MetadataViews.Editions>():
          // There is no max number of NFTs that can be minted from this contract
          // so the max edition field value is set to nil
          let editionInfo = MetadataViews.Edition(name: "FooBar Edition", number: self.id, max: nil)
          let editionList: [MetadataViews.Edition] = [editionInfo]
          return MetadataViews.Editions(
            editionList
          )
        case Type<MetadataViews.Serial>():
          return MetadataViews.Serial(
            self.id
          )
        case Type<MetadataViews.NFTCollectionData>():
          return FooBar.resolveContractView(resourceType: Type<@FooBar.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
        case Type<MetadataViews.NFTCollectionDisplay>():
          return FooBar.resolveContractView(resourceType: Type<@FooBar.NFT>(), viewType: Type<MetadataViews.NFTCollectionDisplay>())
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
      return <-FooBar.createEmptyCollection(nftType: Type<@FooBar.NFT>())
    }
    /// deposit takes a NFT and adds it to the collections dictionary
    /// and adds the ID to the id array
    access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
      let token <- token as! @FooBar.NFT
      let id = token.id

      // add the new token to the dictionary which removes the old one
      let oldToken <- self.ownedNFTs[token.id] <- token

      destroy oldToken
    }
    /// withdraw removes an NFT from the collection and moves it to the caller
    access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
      let token <- self.ownedNFTs.remove(key: withdrawID)
          ?? panic("FooBar.Collection.withdraw: Could not withdraw an NFT with ID "
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
      supportedTypes[Type<@FooBar.NFT>()] = true
      return supportedTypes
    }

    /// Returns whether or not the given type is accepted by the collection
    /// A collection that can accept any type should just return true by default
    access(all) view fun isSupportedNFTType(type: Type): Bool {
      return type == Type<@FooBar.NFT>()
    }
    // Allows a caller to borrow a reference to a specific NFT
    /// so that they can get the metadata views for the specific NFT
    access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
      return &self.ownedNFTs[id]
    }
  }
  access(all) resource NFTMinter {  
    access(all) fun createNFT(): @NFT {
      return <-create NFT()
    }

    init() {
    }
  }

  init() {
    self.CollectionStoragePath = /storage/fooBarNFTCollection
    self.CollectionPublicPath = /public/fooBarNFTCollection
    self.MinterStoragePath = /storage/fooBarNFTMinter
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
          publicCollection: Type<&FooBar.Collection>(),
          publicLinkedType: Type<&FooBar.Collection>(),
          createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
            return <-FooBar.createEmptyCollection(nftType: Type<@FooBar.NFT>())
          })
        )
        return collectionData
      case Type<MetadataViews.NFTCollectionDisplay>():
        let media = MetadataViews.Media(
          file: MetadataViews.HTTPFile(
            url: "Add your own SVG+XML link here"
          ),
          mediaType: "image/svg+xml"
        )
        return MetadataViews.NFTCollectionDisplay(
          name: "The FooBar Example Collection",
          description: "This collection is used as an example to help you develop your next Flow NFT.",
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

}