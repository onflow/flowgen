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

    prepare(buyerAcct: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, SaveValue, UnpublishCapability, Storage) &Account) {
        if buyerAcct.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath) == nil {
            panic("Buyer does not have a FlowGenPixel Collection. Please run setup transaction first.")
        }
        self.buyerPixelCollectionCapOpt = buyerAcct.capabilities.get<&{NonFungibleToken.Receiver}>(
                FlowGenPixel.CollectionPublicPath
            )

        let mainFlowVault = buyerAcct.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(from: /storage/flowTokenVault)
            ?? panic("Cannot borrow Flow Token vault from buyer's account. Vault might not exist or path is incorrect.")
        self.paymentVault <- mainFlowVault.withdraw(amount: paymentAmount)

        let feeReceiverAccount = getAccount(feeReceiverAddress)
        self.feeReceiverCapOpt = feeReceiverAccount.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        
        self.nftMinterRef = buyerAcct.storage.borrow<&FlowGenPixel.NFTMinter>(from: FlowGenPixel.MinterStoragePath)
            ?? panic("Could not borrow NFTMinter reference. Signer might not be admin or Minter not at path.")
    }

    execute {
        let buyerPixelCollectionCap = self.buyerPixelCollectionCapOpt ?? panic("Buyer's FlowGenPixel Collection receiver capability not found.")
        if !buyerPixelCollectionCap.check() {
             panic("Buyer's FlowGenPixel Collection receiver capability is not valid.")
        }

        let feeReceiverCap = self.feeReceiverCapOpt ?? panic("Fee receiver capability not found.")
        if !feeReceiverCap.check(){
            panic("Fee receiver capability is not valid.")
        }

        let expectedPrice = FlowGenCanvas.getCurrentPrice()
        if paymentAmount != expectedPrice { 
            panic("Payment amount (".concat(paymentAmount.toString()).concat(") does not match the current price (").concat(expectedPrice.toString()).concat(")."))
        }

        if FlowGenCanvas.isPixelTaken(x: x, y: y) {
            panic("Pixel at coordinates (".concat(x.toString()).concat(", ").concat(y.toString()).concat(") is already taken."))
        }

        let feeReceiver = feeReceiverCap.borrow()
            ?? panic("Could not borrow fee receiver capability.")
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