import "NonFungibleToken"
import "MetadataViews"
import "ViewResolver"
access(all) contract CanvasBackground: NonFungibleToken {

    // --- Contract Fields ---
    access(all) var totalSupply: UInt64 // Total number of historical background NFTs minted
    access(all) let CANVAS_WIDTH: UInt16
    access(all) let CANVAS_HEIGHT: UInt16
    access(all) var currentVersionNumber: UInt64 // Tracks the latest version number minted
    access(all) var latestBackgroundNftID: UInt64? // ID of the most recent background NFT

    // --- Paths ---
    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath: PublicPath
    access(all) let AdminStoragePath: StoragePath

    // --- Events ---
    access(all) event ContractInitialized()
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event Deposit(id: UInt64, to: Address?, isMinting: Bool)
    // Emitted when a new historical background NFT is minted
    access(all) event NewBackgroundMinted(
        id: UInt64,
        imageHash: String,
        versionNumber: UInt64,
        timestamp: UFix64,
        canvasWidth: UInt16,
        canvasHeight: UInt16,
        triggeringPixelID: UInt64?,
        triggeringEventTransactionID: String?,
        triggeringAiImageID: UInt64?,
        latestBackgroundNftID: UInt64 // Reports the new latest ID
    )
    // No BackgroundNFTUpdated event anymore, as NFTs are immutable snapshots

    // --- NFT Resource (Each instance is an immutable historical snapshot) ---
    access(all) resource NFT: NonFungibleToken.NFT, ViewResolver.Resolver {
        access(all) let id: UInt64
        access(all) let imageHash: String // IPFS CID of the composite canvas image (immutable per NFT)
        access(all) let versionNumber: UInt64 // Sequential version for this snapshot
        access(all) let timestamp: UFix64     // Block timestamp of minting
        access(all) let canvasWidth: UInt16
        access(all) let canvasHeight: UInt16
        access(all) let triggeringPixelID: UInt64? // Optional: Pixel that triggered this version
        access(all) let triggeringEventTransactionID: String? // Optional: Tx hash of the triggering event
        access(all) let triggeringAiImageID: UInt64? // Optional: AI Image on the pixel that triggered this version

        init(
            imageHash: String,
            versionNumber: UInt64,
            timestamp: UFix64,
            canvasWidth: UInt16,
            canvasHeight: UInt16,
            triggeringPixelID: UInt64?,
            triggeringEventTransactionID: String?,
            triggeringAiImageID: UInt64?
        ) {
            // id is self.uuid, set by NonFungibleToken standard on NFT creation by contract
            self.id = self.uuid 
            self.imageHash = imageHash
            self.versionNumber = versionNumber
            self.timestamp = timestamp
            self.canvasWidth = canvasWidth
            self.canvasHeight = canvasHeight
            self.triggeringPixelID = triggeringPixelID
            self.triggeringEventTransactionID = triggeringEventTransactionID
            self.triggeringAiImageID = triggeringAiImageID
        }

        // updateData function removed as NFT is now an immutable snapshot

        access(all) view fun getViews(): [Type] {
            return [
                Type<MetadataViews.Display>(),
                Type<MetadataViews.ExternalURL>(),
                Type<MetadataViews.Media>(),
                Type<MetadataViews.NFTCollectionData>(),
                Type<MetadataViews.Serial>() // versionNumber can act as a serial
                // Potentially custom views for timestamp, triggeringPixelID etc.
            ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    let name = "FlowGen Canvas Background - v".concat(self.versionNumber.toString())
                    let description = "Historical background image for the FlowGen canvas. Version: ".concat(self.versionNumber.toString())
                        .concat(", Timestamp: ").concat(self.timestamp.toString())
                        .concat(". Resolution: ").concat(self.canvasWidth.toString()).concat("x").concat(self.canvasHeight.toString())
                    let thumbnailURL = self.imageHash == "" ? "https://flowgen.art/placeholder-background.png" : "https://".concat(self.imageHash).concat(".ipfs.w3s.link")
                    let thumbnail = MetadataViews.HTTPFile(url: thumbnailURL)
                    return MetadataViews.Display(name: name, description: description, thumbnail: thumbnail)
                case Type<MetadataViews.ExternalURL>():
                    // Could link to a viewer that shows this specific historical version
                    return MetadataViews.ExternalURL("https://flowgen.art/canvas?version=".concat(self.versionNumber.toString()))
                case Type<MetadataViews.Media>():
                    let imageURL = self.imageHash == "" ? "https://flowgen.art/placeholder-background.png" : "https://".concat(self.imageHash).concat(".ipfs.w3s.link")
                    return MetadataViews.Media(file: MetadataViews.HTTPFile(url: imageURL), mediaType: "image/png")
                case Type<MetadataViews.NFTCollectionData>():
                    return CanvasBackground.resolveContractView(resourceType: Type<@CanvasBackground.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
                case Type<MetadataViews.Serial>():
                    return MetadataViews.Serial(self.versionNumber) // Use versionNumber as serial
            }
            return nil
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- CanvasBackground.createEmptyCollection(nftType: Type<@CanvasBackground.NFT>())
        }
    }

    // --- Admin Resource ---
    access(all) resource Admin {
        // Mints a new historical background NFT
        access(all) fun mintNewBackground(
            imageHash: String,
            triggeringPixelID: UInt64?,
            triggeringEventTransactionID: String?,
            triggeringAiImageID: UInt64?
            // canvasWidth and canvasHeight are now contract constants
        ): @NFT {
            // Increment version number for the new NFT
            CanvasBackground.currentVersionNumber = CanvasBackground.currentVersionNumber + 1
            
            let newNFT <- create NFT(
                imageHash: imageHash,
                versionNumber: CanvasBackground.currentVersionNumber,
                timestamp: getCurrentBlock().timestamp,
                canvasWidth: CanvasBackground.CANVAS_WIDTH,
                canvasHeight: CanvasBackground.CANVAS_HEIGHT,
                triggeringPixelID: triggeringPixelID,
                triggeringEventTransactionID: triggeringEventTransactionID,
                triggeringAiImageID: triggeringAiImageID
            )

            // Update the latestBackgroundNftID at the contract level
            CanvasBackground.latestBackgroundNftID = newNFT.id
            
            emit NewBackgroundMinted(
                id: newNFT.id,
                imageHash: newNFT.imageHash,
                versionNumber: newNFT.versionNumber,
                timestamp: newNFT.timestamp,
                canvasWidth: newNFT.canvasWidth,
                canvasHeight: newNFT.canvasHeight,
                triggeringPixelID: newNFT.triggeringPixelID,
                triggeringEventTransactionID: newNFT.triggeringEventTransactionID,
                triggeringAiImageID: newNFT.triggeringAiImageID,
                latestBackgroundNftID: newNFT.id // Emit the new latest ID
            )
            
            // totalSupply is handled by the standard Collection deposit logic if needed by NonFungibleToken standard
            // or explicitly here if we want to track it independently of collection deposits by users
            // For now, let's assume NonFungibleToken standard handles it via collection.
            // If this Admin resource also deposits it into a central contract collection, that's where totalSupply would increment.

            return <-newNFT
        }

        // mintInitialBackgroundNFT function removed, initial minting will use mintNewBackground
        // via a setup transaction.
    }

    // --- Standard NFT Collection (Users could potentially own historical backgrounds) ---
    access(all) resource interface CanvasBackgroundCollectionPublic {
        access(all) fun deposit(token: @{NonFungibleToken.NFT})
        access(all) view fun getIDs(): [UInt64]
        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}?
        access(all) view fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}?
        // borrowCanvasBackgroundNFT is removed as borrowNFT + downcast OR specific views should suffice
    }

    access(all) resource Collection: NonFungibleToken.Collection, CanvasBackgroundCollectionPublic {
        access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}}

        init() {
            self.ownedNFTs <- {}
        }

        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let token <- self.ownedNFTs.remove(key: withdrawID) ?? panic("Cannot withdraw non-existent NFT")
            emit Withdraw(id: withdrawID, from: self.owner?.address)
            return <-token
        }

        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let nft <- token as! @CanvasBackground.NFT
            let id = nft.id
            
            let oldToken <- self.ownedNFTs[id] <- nft
            
            if oldToken == nil { // Only increment totalSupply if it's a new deposit not a replacement (should always be new for this model)
                CanvasBackground.totalSupply = CanvasBackground.totalSupply + 1
            }
            destroy oldToken
            
            // isMinting is true if the contract is minting it directly into its own collection.
            // If a user is depositing an already minted one, it's false.
            // The mintNewBackground function returns the @NFT, the caller (transaction) deposits it.
            emit Deposit(id: id, to: self.owner?.address, isMinting: false) 
        }

        access(all) view fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id]
        }

        access(all) view fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}? {
            // First, try to get the concrete &CanvasBackground.NFT type
            // self.borrowNFT(id) returns &{NonFungibleToken.NFT}?
            // Casting it to &CanvasBackground.NFT? and then unwrapping with if let:
            if let concreteNft = self.borrowNFT(id) as? &CanvasBackground.NFT {
                // concreteNft is now &CanvasBackground.NFT (non-optional)
                // Since CanvasBackground.NFT implements ViewResolver.Resolver, this upcast is direct.
                return concreteNft as &{ViewResolver.Resolver}
            }
            return nil
        }
        
        // borrowCanvasBackgroundNFT removed, use borrowNFT and downcast if specific type is needed by caller.

        access(all) view fun getSupportedNFTTypes(): {Type: Bool} {
            let supportedTypes: {Type: Bool} = {}
            supportedTypes[Type<@CanvasBackground.NFT>()] = true
            return supportedTypes
        }

        access(all) view fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@CanvasBackground.NFT>()
        }

         access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- CanvasBackground.createEmptyCollection(nftType: Type<@CanvasBackground.NFT>())
        }
    }

    // --- Contract Initializer ---
    init(canvasWidth: UInt16, canvasHeight: UInt16 /* initialEmptyCanvasHash no longer needed here */) {
        self.totalSupply = 0
        self.CANVAS_WIDTH = canvasWidth
        self.CANVAS_HEIGHT = canvasHeight
        self.currentVersionNumber = 0 // Initial version before any mints
        self.latestBackgroundNftID = nil // No background NFT minted yet

        self.CollectionStoragePath = /storage/canvasBackgroundHistoricalCollection
        self.CollectionPublicPath = /public/canvasBackgroundHistoricalCollection
        self.AdminStoragePath = /storage/canvasBackgroundAdmin

        let admin <- create Admin()
        self.account.storage.save(<-admin, to: self.AdminStoragePath)
        
        // A separate transaction by the deployer will call Admin.mintNewBackground
        // with an initial state (e.g., blank canvas hash) to create version 1.
        // That transaction will also likely set up a public capability to the collection
        // if users are meant to browse/hold these historical NFTs.

        emit ContractInitialized()
    }

     access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        return <- create Collection()
    }

    // getContractViews and resolveContractView remain largely the same,
    // but NFTCollectionDisplay name/description can be updated to reflect historical collection.
    access(all) view fun getContractViews(resourceType: Type?): [Type] {
        return [
            Type<MetadataViews.NFTCollectionData>(),
            Type<MetadataViews.NFTCollectionDisplay>()
        ]
    }

    access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
        switch viewType {
            case Type<MetadataViews.NFTCollectionData>():
                return MetadataViews.NFTCollectionData(
                    storagePath: self.CollectionStoragePath,
                    publicPath: self.CollectionPublicPath,
                    publicCollection: Type<&CanvasBackground.Collection>(),
                    publicLinkedType: Type<&CanvasBackground.Collection>(),
                    createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
                        return <-CanvasBackground.createEmptyCollection(nftType: Type<@CanvasBackground.NFT>())
                    })
                )
            case Type<MetadataViews.NFTCollectionDisplay>():
                let media = MetadataViews.Media(
                    file: MetadataViews.HTTPFile(url: "https://flowgen.art/default-canvas-background-collection-historical.png"), // Placeholder
                    mediaType: "image/png"
                )
                return MetadataViews.NFTCollectionDisplay(
                    name: "FlowGen Canvas Background - Historical Collection",
                    description: "A collection of all historical states of the FlowGen collaborative canvas background.",
                    externalURL: MetadataViews.ExternalURL("https://flowgen.art/canvas-history"),
                    squareImage: media,
                    bannerImage: media,
                    socials: {}
                )
        }
        return nil
    }

    // getBackgroundNFTView is removed as we now have latestBackgroundNftID.
    // A script would be used to fetch the NFT data using this ID.
    // e.g., a script getLatestBackgroundInfo() -> CanvasBackground.NFT? or specific fields.
}