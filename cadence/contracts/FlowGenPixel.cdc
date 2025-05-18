// FlowGenPixel.cdc

import "NonFungibleToken"
import "MetadataViews" // Assuming this import correctly brings ViewResolver's members into scope too
import "FungibleToken"
import "FlowGenAiImage" // Added import

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
    access(all) event PixelMinted(id: UInt64, x: UInt16, y: UInt16, aiImageNftID: UInt64) // Updated event

    // For tracking minted pixels to ensure uniqueness using a String key "x,y"
    access(contract) var registeredPixelKeys: {String: UInt64}


    access(all) resource NFT: NonFungibleToken.NFT {
        access(all) let id: UInt64
        access(all) let x: UInt16
        access(all) let y: UInt16
        access(all) let aiImageNftID: UInt64 // Added field to link to the AI Image NFT

        init(
            x: UInt16,
            y: UInt16,
            aiImageNftID: UInt64
        ) {
            self.id = self.uuid 
            self.x = x
            self.y = y
            self.aiImageNftID = aiImageNftID
            // Royalties are now handled by FlowGenAiImage.NFT
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} { 
            return <- FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
        }
        
        access(all) view fun getViews(): [Type] {
            return [
                Type<MetadataViews.Display>(),
                Type<MetadataViews.ExternalURL>(),
                Type<MetadataViews.NFTCollectionData>(),
                Type<MetadataViews.NFTCollectionDisplay>()
            ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    // Placeholder for pixel thumbnail - this needs design decision
                    let pixelThumbnail = MetadataViews.HTTPFile(url: "https://flowgen.art/pixel_placeholder.png") 
                    let nameString = "Pixel (".concat(self.x.toString()).concat(", ").concat(self.y.toString()).concat(")")
                    let descriptionString = "A pixel on the FlowGen Canvas at coordinates (".concat(self.x.toString()).concat(", ").concat(self.y.toString()).concat(") displaying Artwork ID: ").concat(self.aiImageNftID.toString())
                    return MetadataViews.Display(
                        name: nameString, 
                        description: descriptionString, 
                        thumbnail: pixelThumbnail
                    )
                case Type<MetadataViews.ExternalURL>():
                    // URL to the pixel on the platform, e.g., /pixel/10,20
                    let url = "https://flowgen.art/pixel/"
                        .concat(self.x.toString())
                        .concat("-")
                        .concat(self.y.toString())
                    return MetadataViews.ExternalURL(url)
                case Type<MetadataViews.NFTCollectionData>():
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
                case Type<MetadataViews.NFTCollectionDisplay>():
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionDisplay>())
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
            x: UInt16,
            y: UInt16,
            aiImageNftID: UInt64
        ): @NFT {
            let pixelKeyStr = x.toString().concat(",").concat(y.toString())
            if FlowGenPixel.registeredPixelKeys[pixelKeyStr] != nil {
                panic("Pixel at coordinates (".concat(pixelKeyStr).concat(") has already been minted."))
            }

            let newPixelNFT <- create NFT(
                x: x,
                y: y,
                aiImageNftID: aiImageNftID
            )
            
            let nftID = newPixelNFT.id
            FlowGenPixel.registeredPixelKeys[pixelKeyStr] = nftID
            FlowGenPixel.totalSupply = FlowGenPixel.totalSupply + 1
            
            emit PixelMinted(id: nftID, x: x, y: y, aiImageNftID: aiImageNftID)
            return <-newPixelNFT
        }
    }

    // --- Public Minting Function ---
    access(all) fun publicMintPixelNFT(
        // recipientCollection: &{NonFungibleToken.Receiver}, // Deposit handled by transaction
        x: UInt16,
        y: UInt16,
        aiImageNftID: UInt64
    ): @NFT {
        let minter = self.account.storage.borrow<&NFTMinter>(from: self.MinterStoragePath)
            ?? panic("Could not borrow NFTMinter from contract storage")
        
        let newNFT <- minter.mintPixelNFT( // This function already returns @NFT now
            x: x,
            y: y,
            aiImageNftID: aiImageNftID
        )
        // The deposit is now handled by the caller (transaction)
        // recipientCollection.deposit(token: <-newNFT)
        return <-newNFT // Return the NFT to be deposited by the transaction
    }
    // --- End Public Minting Function ---

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
                    file: MetadataViews.HTTPFile(url: "https://flowgen.art/flowgen.png"),
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