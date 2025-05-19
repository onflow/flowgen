import "NonFungibleToken"
import "MetadataViews"
import "ViewResolver"
access(all) contract CanvasBackground: NonFungibleToken {

    // --- Contract Fields ---
    access(all) var totalSupply: UInt64 // Will always be 1 after initialization
    access(all) let CANVAS_WIDTH: UInt16 // To be set during initialization
    access(all) let CANVAS_HEIGHT: UInt16 // To be set during initialization

    // --- Paths ---
    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath: PublicPath
    access(all) let AdminStoragePath: StoragePath
    // Not using BackgroundNFTPublicPath directly for now, will rely on Collection public path

    // --- Events ---
    access(all) event ContractInitialized()
    access(all) event Withdraw(id: UInt64, from: Address?) // Standard NFT
    access(all) event Deposit(id: UInt64, to: Address?, isMinting: Bool)  // Standard NFT
    access(all) event BackgroundNFTMinted(id: UInt64, initialImageHash: String, version: UInt64, canvasWidth: UInt16, canvasHeight: UInt16)
    access(all) event BackgroundNFTUpdated(id: UInt64, newImageHash: String, newVersion: UInt64, updatedBy: Address)

    // --- NFT Resource ---
    access(all) resource NFT: NonFungibleToken.NFT, ViewResolver.Resolver {
        access(all) let id: UInt64
        access(all) var imageHash: String // IPFS CID of the composite canvas image
        access(all) var version: UInt64
        access(all) let canvasWidth: UInt16
        access(all) let canvasHeight: UInt16

        init(imageHash: String, version: UInt64, canvasWidth: UInt16, canvasHeight: UInt16) {
            self.id = 1 // Singleton NFT, always ID 1
            self.imageHash = imageHash
            self.version = version
            self.canvasWidth = canvasWidth
            self.canvasHeight = canvasHeight

            // total Supply is managed by the contract minting function
        }

        // Setter function for imageHash and version
        access(all) fun updateData(_ newImageHash: String) {
            self.imageHash = newImageHash
            self.version = self.version + 1
        }

        access(all) view fun getViews(): [Type] {
            return [
                Type<MetadataViews.Display>(),
                Type<MetadataViews.ExternalURL>(),
                Type<MetadataViews.Media>(),
                Type<MetadataViews.NFTCollectionData>() // For standard collection discovery
            ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    let name = "FlowGen Canvas Background - v".concat(self.version.toString())
                    let description = "The dynamically generated background image for the FlowGen canvas. Resolution: "
                        .concat(self.canvasWidth.toString()).concat("x").concat(self.canvasHeight.toString())
                    // It's good practice to ensure imageHash is not empty before forming URL
                    let thumbnailURL = self.imageHash == "" ? "https://flowgen.art/placeholder-background.png" : "https://".concat(self.imageHash).concat(".ipfs.w3s.link")
                    let thumbnail = MetadataViews.HTTPFile(url: thumbnailURL)
                    return MetadataViews.Display(name: name, description: description, thumbnail: thumbnail)
                case Type<MetadataViews.ExternalURL>():
                    return MetadataViews.ExternalURL("https://flowgen.art/canvas") // Example URL to view the canvas
                case Type<MetadataViews.Media>():
                     // It's good practice to ensure imageHash is not empty before forming URL
                    let imageURL = self.imageHash == "" ? "https://flowgen.art/placeholder-background.png" : "https://".concat(self.imageHash).concat(".ipfs.w3s.link")
                     // Assuming PNG, could be made dynamic if mediaType is stored on NFT
                    return MetadataViews.Media(file: MetadataViews.HTTPFile(url: imageURL), mediaType: "image/png")
                case Type<MetadataViews.NFTCollectionData>():
                    return CanvasBackground.resolveContractView(resourceType: Type<@CanvasBackground.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
            }
            return nil
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            // This NFT type isn't meant to be held in arbitrary user collections in the same way typical NFTs are.
            // It's a singleton managed by the contract.
            // However, to satisfy the NonFungibleToken.NFT interface, we provide a way to create its collection type.
            return <- CanvasBackground.createEmptyCollection(nftType: Type<@CanvasBackground.NFT>())
        }
    }

    // --- Admin Resource ---
    access(all) resource Admin {
        // Function to update the existing singleton Background NFT
        access(all) fun updateBackgroundData(newImageHash: String, updaterAddress: Address) {
            // Borrow the contract's collection
            let collectionRef = CanvasBackground.account.storage.borrow<&CanvasBackground.Collection>(from: CanvasBackground.CollectionStoragePath)
                ?? panic("Could not borrow Background Collection from contract storage.")

            // Borrow the NFT from the collection using the specific type
            let backgroundNFT = collectionRef.borrowCanvasBackgroundNFT(id: 1) // Use the specific borrow
                ?? panic("Could not borrow Background NFT with ID 1 from contract's collection.")

            backgroundNFT.updateData(newImageHash) // Use the new setter function

            emit BackgroundNFTUpdated(id: backgroundNFT.id, newImageHash: backgroundNFT.imageHash, newVersion: backgroundNFT.version, updatedBy: updaterAddress)
        }

        // Function to mint the initial (and only) Background NFT
        // This should only be callable once, typically during contract deployment/initialization transaction.
        access(all) fun mintInitialBackgroundNFT(initialImageHash: String, canvasWidth: UInt16, canvasHeight: UInt16): @NFT {
            pre {
                CanvasBackground.totalSupply == 0: "Background NFT has already been minted."
            }
            let newNFT <- create NFT(
                imageHash: initialImageHash,
                version: 1,
                canvasWidth: canvasWidth,
                canvasHeight: canvasHeight
            )
            CanvasBackground.totalSupply = 1 // Set total supply
            emit BackgroundNFTMinted(id: newNFT.id, initialImageHash: newNFT.imageHash, version: newNFT.version, canvasWidth: newNFT.canvasWidth, canvasHeight: newNFT.canvasHeight)
            return <-newNFT
        }
    }

    // --- Standard NFT Collection (to hold the singleton NFT in contract storage) ---
    access(all) resource interface CanvasBackgroundCollectionPublic {
        access(all) fun deposit(token: @{NonFungibleToken.NFT})
        access(all) view fun getIDs(): [UInt64]
        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? // Standard NFT interface
        access(all) view fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}?
        access(all) view fun borrowCanvasBackgroundNFT(id: UInt64): &CanvasBackground.NFT? // Specific type
    }

    access(all) resource Collection: NonFungibleToken.Collection, CanvasBackgroundCollectionPublic {
        access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}} // Corrected dictionary type

        init() {
            self.ownedNFTs <- {}
        }

        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let token <- self.ownedNFTs.remove(key: withdrawID) ?? panic("Cannot withdraw non-existent NFT")
            // Note: Withdrawing the singleton NFT from the contract's own collection would be unusual.
            return <-token
        }

        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let nft <- token as! @CanvasBackground.NFT
            let id = nft.id
            if id != 1 || self.ownedNFTs[id] != nil {
                panic("Cannot deposit this NFT. It must be the singleton (ID 1) and not already present.")
            }
            let oldToken <- self.ownedNFTs[id] <- nft
            destroy oldToken // Destroy the old placeholder if any
            emit Deposit(id: id, to: self.owner?.address, isMinting: (CanvasBackground.totalSupply == 0 && id == 1) )
        }

        access(all) view fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id]
        }

        access(all) view fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}? {
            if let nft = self.borrowNFT(id) { // This returns &{NonFungibleToken.NFT}?
                 return nft // This should be valid if NFT implements it
            }
            return nil
        }

        access(all) view fun borrowCanvasBackgroundNFT(id: UInt64): &CanvasBackground.NFT? {
            if id != 1 { return nil } // Only ID 1 is valid
            let nftRef: &{NonFungibleToken.NFT}? = &self.ownedNFTs[id]
            return nftRef as? &CanvasBackground.NFT
        }

        // Conformance to NonFungibleToken.Collection
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
    init(canvasWidth: UInt16, canvasHeight: UInt16, initialEmptyCanvasHash: String) {
        self.totalSupply = 0 // Will be set to 1 by mintInitialBackgroundNFT
        self.CANVAS_WIDTH = canvasWidth
        self.CANVAS_HEIGHT = canvasHeight

        self.CollectionStoragePath = /storage/canvasBackgroundSingletonCollection
        self.CollectionPublicPath = /public/canvasBackgroundSingletonCollection
        self.AdminStoragePath = /storage/canvasBackgroundAdmin

        // Create and save the Admin resource
        let admin <- create Admin()
        self.account.storage.save(<-admin, to: self.AdminStoragePath)

        // The contract deployer will then call a transaction to:
        // 1. Borrow the Admin resource.
        // 2. Call admin.mintInitialBackgroundNFT().
        // 3. Create a new CanvasBackground.Collection.
        // 4. Deposit the minted NFT into this collection.
        // 5. Save this collection to self.CollectionStoragePath.
        // 6. Link the public capability to this collection at self.CollectionPublicPath.
        // This is done in a separate transaction to follow best practices for initialization.

        emit ContractInitialized()
    }

     access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        return <- create Collection()
    }

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
                    file: MetadataViews.HTTPFile(url: "https://flowgen.art/default-canvas-background-collection.png"), // Placeholder
                    mediaType: "image/png"
                )
                return MetadataViews.NFTCollectionDisplay(
                    name: "FlowGen Canvas Background",
                    description: "The dynamic background image of the FlowGen collaborative canvas.",
                    externalURL: MetadataViews.ExternalURL("https://flowgen.art/canvas"),
                    squareImage: media,
                    bannerImage: media,
                    socials: {} // Add any relevant social links
                )
        }
        return nil
    }

    // --- Public function to easily borrow a view of the Background NFT ---
    access(all) fun getBackgroundNFTView(): &CanvasBackground.NFT? {
        let collectionCap = self.account.capabilities.get<&{CanvasBackground.CanvasBackgroundCollectionPublic}>(CanvasBackground.CollectionPublicPath)

        if !collectionCap.check() {
            // If the capability doesn't exist or is invalid, panic or return nil
            // For a critical piece of public data, panicking might be appropriate if it's expected to always be there post-setup.
            panic("CanvasBackgroundCollectionPublic capability is not available or invalid at ".concat(CanvasBackground.CollectionPublicPath.toString()))
            // return nil
        }

        let collectionRef = collectionCap.borrow()
            ?? panic("Failed to borrow CanvasBackgroundCollectionPublic from ".concat(CanvasBackground.CollectionPublicPath.toString()))
            // ?? return nil (if you prefer not to panic)

        return collectionRef.borrowCanvasBackgroundNFT(id: 1) // ID is always 1
    }
}