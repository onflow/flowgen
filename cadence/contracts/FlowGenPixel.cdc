// FlowGenPixel.cdc

import "NonFungibleToken"
import "MetadataViews" // Assuming this import correctly brings ViewResolver's members into scope too
import "FungibleToken"
import "ViewResolver" // Re-adding this

access(all) contract FlowGenPixel: NonFungibleToken {

    // Contract-level state
    access(all) var totalSupply: UInt64
    access(all) let CanvasResolution: String

    // Paths
    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath: PublicPath
    access(all) let MinterStoragePath: StoragePath

    // Event definitions (as per NonFungibleToken standard)
    access(all) event ContractInitialized()
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event Deposit(id: UInt64, to: Address?, isMinting: Bool) // isMinting is new in Cadence 1.0 NFT standard

    // Custom event for this contract
    access(all) event PixelMinted(id: UInt64, x: UInt16, y: UInt16, name: String)

    // For tracking minted pixels to ensure uniqueness using a String key "x,y"
    access(contract) var registeredPixelKeys: {String: UInt64}


    access(all) resource NFT: NonFungibleToken.NFT {
        access(all) let id: UInt64
        access(all) let name: String
        access(all) let description: String
        access(all) let thumbnail: MetadataViews.HTTPFile
        access(all) let aiPrompt: String
        access(all) let imageURI: String 
        access(all) let pixelArtURI: String 
        access(all) let imageHash: String
        access(all) let x: UInt16
        access(all) let y: UInt16
        access(self) let royalties: [MetadataViews.Royalty]

        init(
            name: String,
            description: String,
            thumbnailURL: String,
            aiPrompt: String,
            imageURI: String,
            pixelArtURI: String,
            imageHash: String,
            x: UInt16,
            y: UInt16,
            creatorRoyaltyReceiverCap: Capability<&{FungibleToken.Receiver}>,
            royaltyRate: UFix64
        ) {
            self.id = self.uuid 
            self.name = name
            self.description = description
            self.thumbnail = MetadataViews.HTTPFile(url: thumbnailURL)
            self.aiPrompt = aiPrompt
            self.imageURI = imageURI
            self.pixelArtURI = pixelArtURI
            self.imageHash = imageHash
            self.x = x
            self.y = y
            
            self.royalties = [
                MetadataViews.Royalty(
                    receiver: creatorRoyaltyReceiverCap, 
                    cut: royaltyRate,
                    description: "Creator Royalty for AI Pixel"
                )
            ]
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} { 
            return <- FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
        }
        
        access(all) view fun getViews(): [Type] {
            return [
                Type<MetadataViews.Display>(),
                Type<MetadataViews.ExternalURL>(),
                Type<MetadataViews.NFTCollectionData>(),
                Type<MetadataViews.NFTCollectionDisplay>(),
                Type<MetadataViews.Royalties>()
            ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    return MetadataViews.Display(
                        name: self.name,
                        description: self.description,
                        thumbnail: self.thumbnail
                    )
                case Type<MetadataViews.ExternalURL>():
                    return MetadataViews.ExternalURL("https://flowgen.art/pixel/".concat(self.id.toString()))
                case Type<MetadataViews.NFTCollectionData>():
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
                case Type<MetadataViews.NFTCollectionDisplay>():
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionDisplay>())
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
            return <- FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
        }

        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let pixelNFT <- token as! @FlowGenPixel.NFT
            let id = pixelNFT.id
            let oldToken <- self.ownedNFTs[id] <- pixelNFT
            destroy oldToken
        }

        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let token <- self.ownedNFTs.remove(key: withdrawID)
                ?? panic("FlowGenPixel.Collection.withdraw: Could not withdraw an NFT with ID ".concat(withdrawID.toString()))
            return <-token
        }

        access(all) view fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) view fun getSupportedNFTTypes(): {Type: Bool} {
            let supportedTypes: {Type: Bool} = {}
            supportedTypes[Type<@FlowGenPixel.NFT>()] = true
            return supportedTypes
        }

        access(all) view fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@FlowGenPixel.NFT>()
        }

        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id]
        }
    }

    access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        if nftType != Type<@FlowGenPixel.NFT>() {
            panic("createEmptyCollection: This contract only supports its own NFT type.")
        }
        return <- create Collection()
    }

    access(all) resource NFTMinter {
        access(all) fun mintPixelNFT(
            recipientCap: Capability<&{NonFungibleToken.Receiver}>,
            name: String,
            description: String,
            thumbnailURL: String,
            aiPrompt: String,
            imageURI: String,
            pixelArtURI: String,
            imageHash: String,
            x: UInt16,
            y: UInt16,
            creatorAddress: Address,
            royaltyRate: UFix64
        ) {
            let pixelKeyStr = x.toString().concat(",").concat(y.toString())
            if FlowGenPixel.registeredPixelKeys[pixelKeyStr] != nil {
                panic("Pixel at coordinates (".concat(pixelKeyStr).concat(") has already been minted."))
            }

            let creatorAcct = getAccount(creatorAddress)
            let capOpt: Capability<&{FungibleToken.Receiver}>? = creatorAcct.capabilities.get<&{FungibleToken.Receiver}>(
                    MetadataViews.getRoyaltyReceiverPublicPath()
                )
            let creatorRoyaltyReceiverCap = capOpt ?? panic("Creator royalty capability not found or is not valid.")

            let newPixelNFT <- create NFT(
                name: name,
                description: description,
                thumbnailURL: thumbnailURL,
                aiPrompt: aiPrompt,
                imageURI: imageURI,
                pixelArtURI: pixelArtURI,
                imageHash: imageHash,
                x: x,
                y: y,
                creatorRoyaltyReceiverCap: creatorRoyaltyReceiverCap,
                royaltyRate: royaltyRate
            )

            let recipient = recipientCap.borrow()
                ?? panic("Could not borrow recipient capability.")
            
            let nftID = newPixelNFT.id
            recipient.deposit(token: <-newPixelNFT)

            FlowGenPixel.registeredPixelKeys[pixelKeyStr] = nftID
            FlowGenPixel.totalSupply = FlowGenPixel.totalSupply + 1
            
            emit PixelMinted(id: nftID, x: x, y: y, name: name)
        }
    }

    // Required by NonFungibleToken (via ViewResolver)
    access(all) view fun getContractViews(resourceType: Type?): [Type] {
        return [
            Type<MetadataViews.NFTCollectionData>(),
            Type<MetadataViews.NFTCollectionDisplay>()
        ]
    }

    // Required by NonFungibleToken (via ViewResolver)
    access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
        switch viewType {
            case Type<MetadataViews.NFTCollectionData>():
                return MetadataViews.NFTCollectionData(
                    storagePath: self.CollectionStoragePath,
                    publicPath: self.CollectionPublicPath,
                    publicCollection: Type<&FlowGenPixel.Collection>(),
                    publicLinkedType: Type<&FlowGenPixel.Collection>(),
                    createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
                        return <-FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
                    })
                )
            case Type<MetadataViews.NFTCollectionDisplay>():
                let media = MetadataViews.Media(
                    file: MetadataViews.HTTPFile(url: "YOUR_COLLECTION_SQUARE_IMAGE_URL_HERE"),
                    mediaType: "image/*"
                )
                return MetadataViews.NFTCollectionDisplay(
                    name: "FlowGen Pixel Collection",
                    description: "A collection of AI-generated pixels on the FlowGen Canvas. Resolution: ".concat(self.CanvasResolution),
                    externalURL: MetadataViews.ExternalURL("https://flowgen.art/collection"),
                    squareImage: media,
                    bannerImage: media,
                    socials: {
                        "twitter": MetadataViews.ExternalURL("https://twitter.com/YourFlowGenProject")
                    }
                )
        }
        return nil
    }

    init() {
        self.totalSupply = 0
        self.CanvasResolution = "1024x1024" // Default
        self.registeredPixelKeys = {}

        // Path initializations (consider versioning paths, e.g., "V1")
        self.CollectionStoragePath = /storage/flowGenPixelCollection
        self.CollectionPublicPath = /public/flowGenPixelCollection
        self.MinterStoragePath = /storage/flowGenPixelMinter

        // Save the Minter resource to the deploying account's storage
        self.account.storage.save(<-create NFTMinter(), to: self.MinterStoragePath)

        emit ContractInitialized()
    }

    // Public function to check if a pixel key (coordinate) has been minted
    access(all) view fun isPixelMinted(x: UInt16, y: UInt16): Bool {
        let pixelKeyStr = x.toString().concat(",").concat(y.toString())
        return self.registeredPixelKeys[pixelKeyStr] != nil
    }

    // Public function to get the NFT ID for a given pixel key (coordinate)
    access(all) view fun getPixelNFTID(x: UInt16, y: UInt16): UInt64? {
        let pixelKeyStr = x.toString().concat(",").concat(y.toString())
        return self.registeredPixelKeys[pixelKeyStr]
    }
}