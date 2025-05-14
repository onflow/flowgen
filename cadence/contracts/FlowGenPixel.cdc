// FlowGenPixel.cdc

import "NonFungibleToken"
import "MetadataViews" // Assuming this import correctly brings ViewResolver's members into scope too
import "FungibleToken"

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

        // Metadata
        access(all) let name: String
        access(all) let description: String
        access(all) let thumbnail: MetadataViews.HTTPFile // FooBar uses HTTPFile, aligning with that.
        access(all) let aiPrompt: String
        access(all) let imageURI: String // Assumed to be IPFS or HTTP
        access(all) let pixelArtURI: String // Assumed to be IPFS or HTTP
        access(all) let imageHash: String
        access(all) let x: UInt16
        access(all) let y: UInt16
        // Note: FlowGenPixel.CanvasResolution is available at contract scope

        // Royalties are handled via the Royalties view in MetadataViews
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
            creatorRoyaltyReceiver: Capability<&{FungibleToken.Receiver}>, // Correct type for Royalty
            royaltyRate: UFix64
        ) {
            self.id = self.uuid // id is set from the resource's implicit uuid
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
                    receiver: creatorRoyaltyReceiver, // Correct argument label
                    cut: royaltyRate,
                    description: "Creator Royalty for AI Pixel"
                )
            ]
        }

        // Required by NonFungibleToken.NFT interface
        access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
            return <- FlowGenPixel.createEmptyCollection(nftType: nftType)
        }
        
        access(all) view fun getViews(): [Type] {
            return [
                Type<MetadataViews.Display>(),
                Type<MetadataViews.ExternalURL>(),
                Type<MetadataViews.NFTCollectionData>(),
                Type<MetadataViews.NFTCollectionDisplay>(),
                Type<MetadataViews.Royalties>()
                // Add other views like IPFSFile for imageURI/pixelArtURI if desired
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
                    // Example: URL to view this NFT on your platform
                    return MetadataViews.ExternalURL("https://flowgen.art/pixel/".concat(self.id.toString()))
                case Type<MetadataViews.NFTCollectionData>():
                    // Delegate to contract-level resolution as per FooBar.cdc
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
                case Type<MetadataViews.NFTCollectionDisplay>():
                     // Delegate to contract-level resolution
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionDisplay>())
                case Type<MetadataViews.Royalties>():
                    return MetadataViews.Royalties(self.royalties)
            }
            return nil
        }
    }

    access(all) resource Collection: NonFungibleToken.Collection {
        access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}}

        init () {
            self.ownedNFTs <- {}
        }

        // NonFungibleToken.Withdraw interface conformance
        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let token <- self.ownedNFTs.remove(key: withdrawID)
                ?? panic("FlowGenPixel.Collection.withdraw: Could not withdraw NFT with ID ".concat(withdrawID.toString()))
            
            emit Withdraw(id: token.id, from: self.owner?.address)
            return <-token
        }

        // NonFungibleToken.Receiver interface conformance
        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let pixelNFT <- token as! @FlowGenPixel.NFT // Cast to concrete type

            let id = pixelNFT.id
            let oldToken <- self.ownedNFTs[id] <- pixelNFT
            
            // Cadence 1.0 standard: Deposit event includes isMinting
            // Assuming deposits to existing collections are not minting events here.
            // Minting deposits will be handled by the Minter.
            emit Deposit(id: id, to: self.owner?.address, isMinting: false)
            
            destroy oldToken
        }

        // NonFungibleToken.CollectionPublic interface conformance
        access(all) view fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) view fun getLength(): Int {
            return self.ownedNFTs.length
        }

        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            if self.ownedNFTs[id] == nil {
                return nil
            }
            // Get a reference to the NFT
            // The type of &self.ownedNFTs[id] is &NonFungibleToken.NFT{NonFungibleToken.NFT}?
            // Upload-Example uses `return &self.ownedNFTs[id] as &NonFungibleToken.NFT`, let's try that.
            // But FooBar uses `return &self.ownedNFTs[id]` which implies the dictionary is correctly typed.
            return &self.ownedNFTs[id] // Should return &{NonFungibleToken.NFT}?
        }
        
        access(all) view fun borrowViewResolver(id: UInt64): &{MetadataViews.Resolver}? {
            let nft = self.borrowNFT(id)
            if nft == nil {
                return nil
            }
            return nft! as &{MetadataViews.Resolver}
        }
        
        access(all) fun getSupportedNFTTypes(): {Type: Bool} {
            let supportedTypes: {Type: Bool} = {}
            supportedTypes[Type<@FlowGenPixel.NFT>()] = true
            return supportedTypes
        }

        access(all) fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@FlowGenPixel.NFT>()
        }
        
        // Required by NonFungibleToken.CollectionPublic in latest standard
        // access(all) view fun forEachID(_ f: (UInt64) -> Void) {
        //     for key in self.ownedNFTs.keys {
        //         f(key)
        //     }
        // }
    }

    // NonFungibleToken contract interface conformance
    access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        // This function now takes nftType argument as per standard
        // It should ensure that only this contract's NFT type can create its collections if restricted
        if nftType != Type<@FlowGenPixel.NFT>() {
            panic("createEmptyCollection: The type of NFT specified is not supported by this contract.")
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

            // Get royalty receiver capability for the creator
            let creatorAcct = getAccount(creatorAddress)
            let creatorRoyaltyReceiverCap = creatorAcct.capabilities.get<&{FungibleToken.Receiver}>(
                    MetadataViews.getRoyaltyReceiverPublicPath()
                ) ?? panic("Creator account ".concat(creatorAddress.toString()).concat(" has not set up a FungibleToken.Receiver capability at the standard royalty path."))


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
                creatorRoyaltyReceiver: creatorRoyaltyReceiverCap,
                royaltyRate: royaltyRate
            )

            let recipient = recipientCap.borrow()
                ?? panic("Could not borrow recipient capability.")
            
            let nftID = newPixelNFT.id
            recipient.deposit(token: <-newPixelNFT)

            FlowGenPixel.registeredPixelKeys[pixelKeyStr] = nftID
            FlowGenPixel.totalSupply = FlowGenPixel.totalSupply + 1
            
            // Emit our custom event
            emit PixelMinted(id: nftID, x: x, y: y, name: name)
            // Standard Deposit event is emitted by the Collection's deposit function
            // but for minting, it's often also emitted by the minter or a mint function.
            // The `isMinting: true` flag in the standard Deposit event handles this.
            // However, our collection's deposit sets isMinting: false.
            // For mints, NonFungibleToken.cdc itself emits Deposit with isMinting: true
            // if the NFT is directly deposited via a mint function that is part of the standard.
            // Since we have a custom Minter, we might need an explicit Deposit event here if not handled by the collection.
            // For now, relying on the Collection's deposit event.
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
                    publicCollection: Type<&FlowGenPixel.Collection>(), // As per FooBar.cdc
                    publicLinkedType: Type<&FlowGenPixel.Collection>(), // As per FooBar.cdc
                    createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
                        return <-FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>())
                    })
                )
            case Type<MetadataViews.NFTCollectionDisplay>():
                let media = MetadataViews.Media( // Using HTTPFile for consistency with FooBar NFT thumbnail
                    file: MetadataViews.HTTPFile(url: "YOUR_COLLECTION_SQUARE_IMAGE_URL_HERE"), // Replace
                    mediaType: "image/*" // Adjust if not SVG or if type known e.g. image/png
                )
                return MetadataViews.NFTCollectionDisplay(
                    name: "FlowGen Pixel Collection",
                    description: "A collection of AI-generated pixels on the FlowGen Canvas. Resolution: ".concat(self.CanvasResolution),
                    externalURL: MetadataViews.ExternalURL("https://flowgen.art/collection"), // Replace
                    squareImage: media, // Replace with actual media for square
                    bannerImage: media, // Replace with actual media for banner
                    socials: {
                        "twitter": MetadataViews.ExternalURL("https://twitter.com/YourFlowGenProject") // Replace
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
}