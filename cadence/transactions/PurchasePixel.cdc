import "FungibleToken"
import "NonFungibleToken"
import "FlowGenPixel"
import "FlowGenCanvas"

transaction(
    // Pixel Coordinates
    x: UInt16,
    y: UInt16,
    // NFT Metadata
    name: String,
    description: String,
    thumbnailURL: String,
    aiPrompt: String,
    imageURI: String,
    pixelArtURI: String,
    imageHash: String,
    // Payment & Royalty
    paymentAmount: UFix64,
    creatorAddress: Address,
    royaltyRate: UFix64,
    // Addresses
    pixelContractAdminAddress: Address,
    feeReceiverAddress: Address
) {
    let paymentVault: @{FungibleToken.Vault}
    let buyerPixelCollectionCapOpt: Capability<&{NonFungibleToken.Receiver}>?
    let feeReceiverCapOpt: Capability<&{FungibleToken.Receiver}>?
    let nftMinterRef: &FlowGenPixel.NFTMinter

    prepare(buyerAcct: auth(Storage, Capabilities) &Account) { 
        log("DEBUG: PurchasePixel.cdc V8 - Inside PREPARE (Corrected Collection Setup)") 

        // Setup FlowGenPixel Collection if it doesn't exist
        if buyerAcct.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath) == nil {
            log("DEBUG: FlowGenPixel.Collection not found in storage. Creating and saving...")
            buyerAcct.storage.save(
                <-FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>()),
                to: FlowGenPixel.CollectionStoragePath
            )
            log("DEBUG: Saved new FlowGenPixel.Collection to storage.")
            
            let cap = buyerAcct.capabilities.storage.issue<&FlowGenPixel.Collection>(FlowGenPixel.CollectionStoragePath)
            buyerAcct.capabilities.publish(cap, at: FlowGenPixel.CollectionPublicPath)

            log("DEBUG: Linked/Published public capability for FlowGenPixel.Collection.")
        } else {
            log("DEBUG: FlowGenPixel.Collection already exists in storage.")
        }

        // Now, get the Receiver capability from the (now guaranteed to be linked) public path
        self.buyerPixelCollectionCapOpt = buyerAcct.capabilities.get<&{NonFungibleToken.Receiver}>(
            FlowGenPixel.CollectionPublicPath
        )
        if self.buyerPixelCollectionCapOpt == nil || !self.buyerPixelCollectionCapOpt!.check() {
             panic("Could not get a valid Receiver capability for the buyer's FlowGenPixel Collection from the public path.")
        }
        log("DEBUG: Successfully obtained buyerPixelCollectionCapOpt (Receiver Capability).")

        let mainFlowVault = buyerAcct.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(from: /storage/flowTokenVault)
            ?? panic("Cannot borrow Flow Token vault from buyer's account.")
        self.paymentVault <- mainFlowVault.withdraw(amount: paymentAmount)
        log("DEBUG: Withdrew payment.")

        let feeReceiverAccount = getAccount(feeReceiverAddress)
        self.feeReceiverCapOpt = feeReceiverAccount.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        if self.feeReceiverCapOpt == nil || !self.feeReceiverCapOpt!.check() {
            panic("Could not obtain valid capability for fee receiver.")
        }
        log("DEBUG: Obtained fee receiver capability.")
        
        self.nftMinterRef = buyerAcct.storage.borrow<&FlowGenPixel.NFTMinter>(from: FlowGenPixel.MinterStoragePath)
            ?? panic("Could not borrow NFTMinter reference.")
        log("DEBUG: Borrowed NFTMinter reference.")
    }

    execute {
        log("DEBUG: PurchasePixel.cdc - Inside EXECUTE")
        let buyerPixelCollectionCap = self.buyerPixelCollectionCapOpt ?? panic("Buyer's FlowGenPixel Collection receiver capability not found in execute phase.")

        let feeReceiverCap = self.feeReceiverCapOpt ?? panic("Fee receiver capability not found in execute phase.")
        if !feeReceiverCap.check(){ 
            panic("Fee receiver capability is not valid in execute phase.")
        }

        let expectedPrice = FlowGenCanvas.getCurrentPrice()
        if paymentAmount != expectedPrice { 
            panic("Payment amount (".concat(paymentAmount.toString()).concat(") does not match the current price (").concat(expectedPrice.toString()).concat(")."))
        }

        if FlowGenCanvas.isPixelTaken(x: x, y: y) {
            panic("Pixel at coordinates (".concat(x.toString()).concat(", ").concat(y.toString()).concat(") is already taken."))
        }

        let feeReceiver = feeReceiverCap.borrow()!
        feeReceiver.deposit(from: <-self.paymentVault)
        log("Payment deposited to fee receiver.")

        self.nftMinterRef.mintPixelNFT(
            recipientCap: buyerPixelCollectionCap,
            name: name,
            description: description,
            thumbnailURL: thumbnailURL,
            aiPrompt: aiPrompt,
            imageURI: imageURI,
            pixelArtURI: pixelArtURI,
            imageHash: imageHash,
            x: x,
            y: y,
            creatorAddress: creatorAddress,
            royaltyRate: royaltyRate
        )
        log("FlowGenPixel NFT minted and deposited to buyer's collection.")
    }
}