// FlowGenPixel.cdc

import "NonFungibleToken"
import "MetadataViews" // Assuming this import correctly brings ViewResolver's members into scope too
import "FungibleToken"
import "FlowGenAiImage" // Added import
import "PixelPriceCalculator"

access(all) contract FlowGenPixel: NonFungibleToken {

    // Contract-level state
    access(all) var totalPixelsSold: UInt64
    access(all) let CANVAS_WIDTH: UInt16
    access(all) let CANVAS_HEIGHT: UInt16
    access(all) let MAX_SUPPLY: UInt64
    access(all) let BASE_PRICE: UFix64
    access(all) let CENTER_MAX_PRICE_TARGET_MULTIPLIER: UFix64
    access(all) let SCARCITY_PREMIUM_FACTOR: UFix64
    access(all) let PIXEL_SALE_FEE_RECEIVER_ADDRESS: Address

    // Paths
    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath: PublicPath
    access(all) let MinterStoragePath: StoragePath

    // Event definitions (as per NonFungibleToken standard)
    access(all) event ContractInitialized()
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event Deposit(id: UInt64, to: Address?, isMinting: Bool) // isMinting is new in Cadence 1.0 NFT standard

    // Custom event for this contract
    access(all) event PixelMinted(id: UInt64, x: UInt16, y: UInt16, initialAiImageNftID: UInt64)
    access(all) event PixelImageUpdated(pixelId: UInt64, newAiImageNftID: UInt64, x: UInt16, y: UInt16) // New event for image updates

    // For tracking minted pixels to ensure uniqueness using a String key "x,y"
    access(contract) var registeredPixelKeys: {String: UInt64}


    access(all) resource NFT: NonFungibleToken.NFT {
        access(all) let id: UInt64
        access(all) let x: UInt16
        access(all) let y: UInt16
        access(all) var aiImageNftID: UInt64 // Changed to var to allow updates, corrected syntax

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
                    // Dynamic URL for pixel thumbnail
                    let thumbnailUrl = "https://flowgen.art/api/pixel-image/"
                        .concat(self.x.toString())
                        .concat("/")
                        .concat(self.y.toString())
                    let pixelThumbnail = MetadataViews.HTTPFile(url: thumbnailUrl)
                    let nameString = "Pixel (".concat(self.x.toString()).concat(", ").concat(self.y.toString()).concat(")")
                    let descriptionString = "A pixel on the FlowGen Canvas at coordinates (".concat(self.x.toString()).concat(", ").concat(self.y.toString()).concat(") displaying Artwork ID: ").concat(self.aiImageNftID.toString())
                    return MetadataViews.Display(
                        name: nameString, 
                        description: descriptionString, 
                        thumbnail: pixelThumbnail
                    )
                case Type<MetadataViews.ExternalURL>():
                    // URL to the pixel on the platform, e.g., /api/pixel-image/10,20
                    let url = "https://flowgen.art?x="
                        .concat(self.x.toString())
                        .concat("&y=")
                        .concat(self.y.toString())
                    return MetadataViews.ExternalURL(url)
                case Type<MetadataViews.NFTCollectionData>():
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionData>())
                case Type<MetadataViews.NFTCollectionDisplay>():
                    return FlowGenPixel.resolveContractView(resourceType: Type<@FlowGenPixel.NFT>(), viewType: Type<MetadataViews.NFTCollectionDisplay>())
            }
            return nil
        }

        // New function to update the AI Image NFT ID
        // This function should only be callable by the owner of the NFT.
        // Additional checks (e.g., that the caller also owns the new aiImageNftID in FlowGenAiImage contract)
        // would typically be handled by a calling transaction or orchestrator contract.
        access(all) fun updateAiImageNftID(newAiImageNftID: UInt64) {
            // TODO: Consider adding a check here or in a calling contract/transaction
            // to ensure the owner of this PixelNFT also owns the FlowGenAiImage.NFT with newAiImageNftID.
            // This is important to prevent someone from setting an image they don't own.
            // For now, we assume this check is done by the caller.

            self.aiImageNftID = newAiImageNftID
            emit PixelImageUpdated(pixelId: self.id, newAiImageNftID: newAiImageNftID, x: self.x, y: self.y)
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
        // This internal minting function no longer handles payment directly or recipient
        access(all) fun internalMintPixelNFT(
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
            FlowGenPixel.totalPixelsSold = FlowGenPixel.totalPixelsSold + 1
            
            emit PixelMinted(id: nftID, x: x, y: y, initialAiImageNftID: aiImageNftID)
            return <-newPixelNFT
        }
    }

    // --- Public Minting Function ---
    access(all) fun publicMintPixelNFT(
        x: UInt16,
        y: UInt16,
        aiImageNftID: UInt64,
        payment: @{FungibleToken.Vault}
    ): @NFT {
        // 1. Validate Payment
        let currentPrice = FlowGenPixel.getCurrentPixelPrice(x: x, y: y)
        if payment.balance != currentPrice {
            panic("Payment amount (".concat(payment.balance.toString()).concat(") does not match the required price (").concat(currentPrice.toString()).concat(")."))
        }

        // 2. Deposit Payment
        let feeReceiver = getAccount(FlowGenPixel.PIXEL_SALE_FEE_RECEIVER_ADDRESS)
            .capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
            .borrow()
            ?? panic("Could not borrow FungibleToken.Receiver for PIXEL_SALE_FEE_RECEIVER_ADDRESS")
        
        feeReceiver.deposit(from: <-payment)

        // 3. Mint Pixel using internal minter
        let minter = self.account.storage.borrow<&NFTMinter>(from: self.MinterStoragePath)
            ?? panic("Could not borrow NFTMinter from contract storage")
        
        let newNFT <- minter.internalMintPixelNFT( // Call the renamed internal function
            x: x,
            y: y,
            aiImageNftID: aiImageNftID
        )
        
        return <-newNFT
    }
    // --- End Public Minting Function ---

    // --- Pricing Algorithm Function ---
    access(all) view fun getCurrentPixelPrice(x: UInt16, y: UInt16): UFix64 {
       
       return PixelPriceCalculator.calculatePrice(
            x: x,
            y: y,
            canvasWidth: self.CANVAS_WIDTH,
            canvasHeight: self.CANVAS_HEIGHT,
            basePrice: self.BASE_PRICE,
            maxSupply: self.MAX_SUPPLY,
            totalPixelsSold: self.totalPixelsSold,
            centerMaxPriceTargetMultiplier: self.CENTER_MAX_PRICE_TARGET_MULTIPLIER,
            scarcityPremiumFactor: self.SCARCITY_PREMIUM_FACTOR
        )
    }
    // --- End Pricing Algorithm Function ---

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
                    file: MetadataViews.HTTPFile(url: "https://bafybeidjl5s3aydzhrd352phxumlyqmzv7khgi4ndne6pqmaqu5nyhn6gy.ipfs.w3s.link/"),
                    mediaType: "image/*"
                )
                return MetadataViews.NFTCollectionDisplay(
                    name: "FlowGen Pixel Collection",
                    description: "A collection of AI-generated pixels on the FlowGen Canvas. Resolution: ".concat(self.CANVAS_WIDTH.toString()).concat("x").concat(self.CANVAS_HEIGHT.toString()),
                    externalURL: MetadataViews.ExternalURL("https://flowgen.art"),
                    squareImage: media,
                    bannerImage: media,
                    socials: {
                        "twitter": MetadataViews.ExternalURL("https://x.com/flow_blockchain"),
                        "discord": MetadataViews.ExternalURL("https://discord.gg/flow"),
                        "telegram": MetadataViews.ExternalURL("https://t.me/flowblockchain"),
                        "website": MetadataViews.ExternalURL("https://flowgen.art")
                    }
                )
        }
        return nil
    }

    init() {
        self.totalPixelsSold = 0
        self.CANVAS_WIDTH = 16 // Example
        self.CANVAS_HEIGHT = 16 // Example
        self.MAX_SUPPLY = UInt64(self.CANVAS_WIDTH) * UInt64(self.CANVAS_HEIGHT)

        self.BASE_PRICE = 10.0 // e.g., 10 FLOW for edge pixels
        self.CENTER_MAX_PRICE_TARGET_MULTIPLIER = 3.0 // Price can triple due to scarcity
        self.SCARCITY_PREMIUM_FACTOR = 20.0 // Price can triple due to scarcity

        self.PIXEL_SALE_FEE_RECEIVER_ADDRESS = 0x832e53531bdc8fc5 // TODO: REPLACE with actual primary sale fee receiver for pixels
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

    // Public function to get the total number of pixels sold
    access(all) view fun getTotalPixelsSold(): UInt64 {
        return self.totalPixelsSold
    }
}