import FlowGenCanvas from "FlowGenCanvas"
import NonFungibleToken from "NonFungibleToken"
import FungibleToken from "FungibleToken"

transaction(
  x: UInt16,
  y: UInt16,
  prompt: String,
  style: String,
  imageURL: String,
  paymentAmount: UFix64
) {
  // Local variables
  let paymentVault: @FungibleToken.Vault
  let receiver: &{FungibleToken.Receiver}
  let collectionRef: &{NonFungibleToken.CollectionPublic}
  let adminRef: &FlowGenCanvas.Admin
  
  prepare(acct: AuthAccount) {
    // Ensure the account has a FlowGenCanvas collection
    if acct.borrow<&FlowGenCanvas.Collection>(from: FlowGenCanvas.CollectionStoragePath) == nil {
      // Create a new empty collection
      acct.save(<-FlowGenCanvas.createEmptyCollection(), to: FlowGenCanvas.CollectionStoragePath)
      
      // Create a public capability for the collection
      acct.link<&{NonFungibleToken.CollectionPublic, FlowGenCanvas.FlowGenCanvasCollectionPublic, MetadataViews.ResolverCollection}>(
        FlowGenCanvas.CollectionPublicPath,
        target: FlowGenCanvas.CollectionStoragePath
      )
    }
    
    // Get the payment vault
    let mainVault = acct.borrow<&FungibleToken.Vault>(from: /storage/flowTokenVault)
        ?? panic("Cannot borrow Flow token vault from storage")
        
    // Withdraw the payment amount
    self.paymentVault <- mainVault.withdraw(amount: paymentAmount)
    
    // Get the admin reference
    self.adminRef = getAccount(0x01) // Replace with the contract admin address
      .getCapability(/private/FlowGenCanvasAdmin)
      .borrow<&FlowGenCanvas.Admin>()
      ?? panic("Cannot borrow admin reference")
    
    // Get the admin's vault receiver
    self.receiver = getAccount(0x01) // Replace with the contract admin address
      .getCapability(/public/flowTokenReceiver)
      .borrow<&{FungibleToken.Receiver}>()
      ?? panic("Cannot borrow receiver reference")
    
    // Get the collection reference
    self.collectionRef = acct
      .getCapability(FlowGenCanvas.CollectionPublicPath)
      .borrow<&{NonFungibleToken.CollectionPublic}>()
      ?? panic("Cannot borrow collection reference")
  }
  
  execute {
    // Validate the payment amount matches the current price
    let currentPrice = FlowGenCanvas.getCurrentPrice()
    assert(
      paymentAmount >= currentPrice,
      message: "Payment amount must be at least the current price: ".concat(currentPrice.toString())
    )
    
    // Validate the pixel is available
    assert(
      FlowGenCanvas.isPixelAvailable(x: x, y: y),
      message: "Pixel at (".concat(x.toString()).concat(",").concat(y.toString()).concat(") is not available")
    )
    
    // Deposit payment
    self.receiver.deposit(from: <-self.paymentVault)
    
    // Mint the NFT
    self.adminRef.mintNFT(
      recipient: self.collectionRef,
      x: x,
      y: y,
      width: 1, // Single pixel for now
      height: 1, // Single pixel for now
      imageURL: imageURL,
      prompt: prompt,
      style: style
    )
  }
}