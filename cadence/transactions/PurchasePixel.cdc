import FungibleToken from "FungibleToken"
import NonFungibleToken from "NonFungibleToken"
import FlowGenPixel from "FlowGenPixel"
import FlowGenAiImage from "FlowGenAiImage"

transaction(
    // Pixel Coordinates
    x: UInt16,
    y: UInt16,
    // Artwork NFT Metadata
    artworkName: String,
    artworkDescription: String,
    aiPrompt: String,
    ipfsImageCID: String,
    imageMediaType: String,
    // Payment
    paymentAmount: UFix64
) {
    // --- Constants for Transaction --- 
    // PRICE_PER_PIXEL and FLOWGEN_PRIMARY_SALE_RECEIVER_ADDRESS are now managed by FlowGenPixel contract
    // --- End Constants --- 

    let paymentVault: @{FungibleToken.Vault}
    let buyerPixelCollection: &{NonFungibleToken.Receiver}
    let buyerAiImageCollection: &{NonFungibleToken.Receiver}
    // let primarySaleReceiver: &{FungibleToken.Receiver} // Removed, handled by FlowGenPixel contract

    let buyerAddress: Address

    prepare(buyerAcct: auth(Storage, Capabilities) &Account) { 
        // --- Constants defined in prepare block --- 
        // PRICE_PER_PIXEL is now fetched from FlowGenPixel contract or validated against it.
        // FLOWGEN_PRIMARY_SALE_RECEIVER_ADDRESS is handled by FlowGenPixel contract.
        // --- End Constants --- 

        log("PurchasePixel V3 - PREPARE: Starting") 

        self.buyerAddress = buyerAcct.address

        // 0. Price Check - Validate against FlowGenPixel.getCurrentPixelPrice(x: x, y: y)
        let expectedPrice = FlowGenPixel.getCurrentPixelPrice(x: x, y: y)
        if paymentAmount != expectedPrice {
            panic("Payment amount (".concat(paymentAmount.toString()).concat(") does not match the current dynamic price (").concat(expectedPrice.toString()).concat(")."))
        }

        // 1. Check if Pixel is already minted (using FlowGenPixel contract directly)
        if FlowGenPixel.isPixelMinted(x: x, y: y) {
            panic("Pixel at coordinates (".concat(x.toString()).concat(", ").concat(y.toString()).concat(") is already taken."))
        }

        // 2. Setup/Borrow Buyer's FlowGenPixel Collection
        if buyerAcct.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath) == nil {
            log("PREPARE: FlowGenPixel.Collection not found. Creating...")
            buyerAcct.storage.save(<-FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>()), to: FlowGenPixel.CollectionStoragePath)
            buyerAcct.capabilities.publish(buyerAcct.capabilities.storage.issue<&FlowGenPixel.Collection>(FlowGenPixel.CollectionStoragePath), at: FlowGenPixel.CollectionPublicPath)
            log("PREPARE: FlowGenPixel.Collection created and published.")
        }
        self.buyerPixelCollection = buyerAcct.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath)
            ?? panic("Cannot borrow FlowGenPixel.Collection receiver from buyer account")
        log("PREPARE: Borrowed buyer's FlowGenPixel Collection receiver.")

        // 3. Setup/Borrow Buyer's FlowGenAiImage Collection
        if buyerAcct.storage.borrow<&FlowGenAiImage.Collection>(from: FlowGenAiImage.CollectionStoragePath) == nil {
            log("PREPARE: FlowGenAiImage.Collection not found. Creating...")
            buyerAcct.storage.save(<-FlowGenAiImage.createEmptyCollection(nftType: Type<@FlowGenAiImage.NFT>()), to: FlowGenAiImage.CollectionStoragePath)
            buyerAcct.capabilities.publish(buyerAcct.capabilities.storage.issue<&FlowGenAiImage.Collection>(FlowGenAiImage.CollectionStoragePath), at: FlowGenAiImage.CollectionPublicPath)
            log("PREPARE: FlowGenAiImage.Collection created and published.")
        }
        self.buyerAiImageCollection = buyerAcct.storage.borrow<&FlowGenAiImage.Collection>(from: FlowGenAiImage.CollectionStoragePath)
            ?? panic("Cannot borrow FlowGenAiImage.Collection receiver from buyer account")
        log("PREPARE: Borrowed buyer's FlowGenAiImage Collection receiver.")

        // 4. Prepare Payment Vault
        let mainFlowVault = buyerAcct.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Provider}>(from: /storage/flowTokenVault)
            ?? panic("Cannot borrow Flow Token vault (as Provider) from buyer's account.")
        self.paymentVault <- mainFlowVault.withdraw(amount: paymentAmount)
        log("PREPARE: Withdrew payment from buyer's vault.")

        // 5. Get Primary Sale Receiver Capability - NO LONGER NEEDED HERE
        // self.primarySaleReceiver = getAccount(FLOWGEN_PRIMARY_SALE_RECEIVER_ADDRESS)
        //     .capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        //     .borrow() ?? panic("Could not borrow receiver capability for primary sale receiver.")
        // log("PREPARE: Borrowed primary sale receiver capability.")

        log("PurchasePixel V3 - PREPARE: Finished")
    }

    execute {
        log("PurchasePixel V3 - EXECUTE: Starting")

        // 1. Deposit Payment to Primary Sale Receiver - NO LONGER DONE DIRECTLY HERE
        // self.primarySaleReceiver.deposit(from: <-self.paymentVault)
        // log("EXECUTE: Payment deposited to primary sale receiver.")

        // 2. Mint FlowGenAiImage.NFT by calling public contract function
        // The buyer (signer) is the creator of the artwork
        let newAiImage <- FlowGenAiImage.publicMintAiImageNFT(
            recipientCollection: self.buyerAiImageCollection, // Pass the receiver capability
            name: artworkName,
            description: artworkDescription,
            aiPrompt: aiPrompt,
            ipfsImageCID: ipfsImageCID,
            imageMediaType: imageMediaType,
            creatorAddress: self.buyerAddress // Buyer is the creator
        )
        let newAiImageNftID = newAiImage.id
        log("EXECUTE: FlowGenAiImage.NFT minted with ID: ".concat(newAiImageNftID.toString()))

        // 3. Deposit FlowGenAiImage.NFT to Buyer's Collection (already done by publicMint if it took receiver, otherwise do it here)
        // The publicMintAiImageNFT now returns the @NFT, so we deposit it here.
        self.buyerAiImageCollection.deposit(token: <-newAiImage)
        log("EXECUTE: Deposited FlowGenAiImage.NFT to buyer's AiImage collection.")

        // 4. Mint FlowGenPixel.NFT by calling public contract function
        // Payment is now passed to the public mint function
        let newPixel <- FlowGenPixel.publicMintPixelNFT(
            x: x,
            y: y,
            aiImageNftID: newAiImageNftID,
            payment: <-self.paymentVault // Pass the payment vault here
        )
        log("EXECUTE: FlowGenPixel.NFT minted with ID: ".concat(newPixel.id.toString()))

        // 5. Deposit FlowGenPixel.NFT to Buyer's Collection
        // The publicMintPixelNFT now returns the @NFT, so we deposit it here.
        self.buyerPixelCollection.deposit(token: <-newPixel)
        log("EXECUTE: Deposited FlowGenPixel.NFT to buyer's Pixel collection.")

        log("PurchasePixel V3 - EXECUTE: Finished Successfully!")
    }
}