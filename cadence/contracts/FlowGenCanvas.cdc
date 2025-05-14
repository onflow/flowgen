import "NonFungibleToken"
import "MetadataViews"
import "FungibleToken"
import "ViewResolver"

/// @title FlowGen Canvas
/// @notice NFT canvas where users can mint pixel NFTs
/// @dev Updated for Cadence 1.0
access(all) contract FlowGenCanvas {
  // Events
  access(all) event ContractInitialized()
  access(all) event PixelMinted(id: UInt64, x: UInt16, y: UInt16, owner: Address)
  access(all) event PixelImageUpdated(id: UInt64, imageURL: String)
  access(all) event PixelTransferred(id: UInt64, from: Address?, to: Address?)
  access(all) event PriceUpdated(newPrice: UFix64)
  
  // Storage Paths
  access(all) let CollectionStoragePath: StoragePath
  access(all) let CollectionPublicPath: PublicPath
  access(all) let MinterStoragePath: StoragePath
  access(all) let AdminStoragePath: StoragePath
  
  // Total canvas dimensions
  access(all) let canvasWidth: UInt16
  access(all) let canvasHeight: UInt16
  
  // Pixel grid status tracking
  access(self) let pixelGrid: {String: Bool}
  
  // Total pixel count and sold count for pricing algorithm
  access(all) var totalPixels: UInt64
  access(all) var soldPixels: UInt64
  
  // Base price for pixels - adjusts dynamically based on sales
  access(all) var basePrice: UFix64
  
  // Total supply of NFTs
  access(all) var totalSupply: UInt64
  access(all) var currentPrice: UFix64
  
  // Error messages
  access(all) fun collectionNotConfiguredError(address: Address): String {
    return "Collection not configured for address: ".concat(address.toString())
  }
  
  // Define the withdrawal entitlement
  access(all) entitlement Withdraw 
  
  // NFT resource
  access(all) resource NFT: NonFungibleToken.NFT, ViewResolver.Resolver {
    // The ID of the NFT (required by NonFungibleToken.NFT)
    access(all) let id: UInt64
    
    // Pixel properties
    access(all) let x: UInt16
    access(all) let y: UInt16
    access(all) let width: UInt16
    access(all) let height: UInt16
    
    // AI generation metadata
    access(all) var imageURL: String
    access(all) var prompt: String
    access(all) var style: String
    access(all) var mintedAt: UFix64
    access(all) var purchasePrice: UFix64
    
    init(
      id: UInt64,
      x: UInt16,
      y: UInt16,
      width: UInt16,
      height: UInt16,
      imageURL: String,
      prompt: String,
      style: String,
      purchasePrice: UFix64
    ) {
      self.id = id
      self.x = x
      self.y = y
      self.width = width
      self.height = height
      self.imageURL = imageURL
      self.prompt = prompt
      self.style = style
      self.mintedAt = getCurrentBlock().timestamp
      self.purchasePrice = purchasePrice
    }
    
    // Update the image for this pixel space (allows regeneration)
    access(all) fun updateImage(newImageURL: String, newPrompt: String, newStyle: String) {
      self.imageURL = newImageURL
      self.prompt = newPrompt
      self.style = newStyle
      
      emit PixelImageUpdated(id: self.id, imageURL: newImageURL)
    }
    
    // NFT interface implementation
    access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
      return <- create Collection()
    }
    
    // Required by NonFungibleToken.NFT interface
    access(all) view fun getAvailableSubNFTS(): {Type: [UInt64]} {
      return {}
    }
    
    // Required by NonFungibleToken.NFT interface
    access(all) fun getSubNFT(type: Type, id: UInt64): &{NonFungibleToken.NFT}? {
      return nil
    }
    
    // Implement ViewResolver.Resolver interface
    access(all) view fun getViews(): [Type] {
      return [
        Type<MetadataViews.Display>(),
        Type<MetadataViews.Royalties>(),
        Type<MetadataViews.ExternalURL>(),
        Type<MetadataViews.NFTCollectionData>(),
        Type<MetadataViews.NFTCollectionDisplay>(),
        Type<MetadataViews.Serial>()
      ]
    }
    
    access(all) fun resolveView(_ view: Type): AnyStruct? {
      switch view {
        case Type<MetadataViews.Display>():
          return MetadataViews.Display(
            name: "FlowGen Pixel #".concat(self.id.toString()),
            description: "AI-generated pixel space at position (".concat(self.x.toString()).concat(",").concat(self.y.toString()).concat(")"),
            thumbnail: MetadataViews.HTTPFile(
              url: self.imageURL
            )
          )
          
        case Type<MetadataViews.Royalties>():
          // 5% creator royalty on secondary sales
          let royalties: [MetadataViews.Royalty] = []
          let creatorAddress: Address = 0x01 // Replace with actual creator address
          
          royalties.append(
            MetadataViews.Royalty(
              receiver: getAccount(creatorAddress).capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver),
              cut: 0.05, // 5%
              description: "Creator royalty from FlowGen"
            )
          )
          
          return MetadataViews.Royalties(royalties)
          
        case Type<MetadataViews.ExternalURL>():
          return MetadataViews.ExternalURL("https://flowgen.me/pixels/".concat(self.id.toString()))
          
        case Type<MetadataViews.NFTCollectionData>():
          return MetadataViews.NFTCollectionData(
            storagePath: FlowGenCanvas.CollectionStoragePath,
            publicPath: FlowGenCanvas.CollectionPublicPath,
            publicCollection: Type<&{FlowGenCanvas.FlowGenCanvasCollectionPublic}>(),
            publicLinkedType: Type<&{FlowGenCanvas.FlowGenCanvasCollectionPublic, NonFungibleToken.CollectionPublic}>(),
            createEmptyCollectionFunction: (fun (): @NonFungibleToken.Collection {
              return <-FlowGenCanvas.createEmptyCollection()
            })
          )
          
        case Type<MetadataViews.Serial>():
          return MetadataViews.Serial(
            self.id
          )

        default:
          return nil
      }
    }
  }
  
  // Collection interface that implements required standards
  access(all) resource interface FlowGenCanvasCollectionPublic {
    access(all) fun deposit(token: @NonFungibleToken.NFT)
    access(all) view fun getIDs(): [UInt64]
    access(all) view fun borrowNFT(id: UInt64): &NonFungibleToken.NFT?
    access(all) fun borrowPixel(id: UInt64): &FlowGenCanvas.NFT?
    access(all) fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}
  }
  
  // Collection resource that contains the NFTs
  access(all) resource Collection: 
    FlowGenCanvasCollectionPublic,
    NonFungibleToken.Provider, 
    NonFungibleToken.Receiver, 
    NonFungibleToken.CollectionPublic,
    ViewResolver.ResolverCollection
  {
    // Dictionary of NFTs
    access(all) var ownedNFTs: @{UInt64: NonFungibleToken.NFT}
    
    init() {
      self.ownedNFTs <- {}
    }
    
    // Withdraw NFT from collection - requires Withdraw entitlement
    access(Withdraw) fun withdraw(withdrawID: UInt64): @NonFungibleToken.NFT {
      let token <- self.ownedNFTs.remove(key: withdrawID) ?? panic("Missing NFT")
      emit PixelTransferred(id: token.id, from: self.owner?.address, to: nil)
      return <- token
    }
    
    // Deposit NFT to collection
    access(all) fun deposit(token: @NonFungibleToken.NFT) {
      let token <- token as! @FlowGenCanvas.NFT
      let id = token.id
      
      // Add the new token to the dictionary
      let oldToken <- self.ownedNFTs[id] <- token
      
      emit PixelTransferred(id: id, from: nil, to: self.owner?.address)
      
      destroy oldToken
    }
    
    // Get all NFT IDs in collection
    access(all) view fun getIDs(): [UInt64] {
      return self.ownedNFTs.keys
    }
    
    // Borrow a reference to an NFT in the collection
    access(all) view fun borrowNFT(id: UInt64): &NonFungibleToken.NFT? {
      if self.ownedNFTs[id] != nil {
        let ref = &self.ownedNFTs[id] as &NonFungibleToken.NFT
        return ref
      }
      return nil
    }
    
    // Borrow a reference to an NFT as an FlowGenCanvas.NFT
    access(all) fun borrowPixel(id: UInt64): &FlowGenCanvas.NFT? {
      if self.ownedNFTs[id] != nil {
        let ref = &self.ownedNFTs[id] as auth(FlowGenCanvas.Withdraw) &NonFungibleToken.NFT
        return ref as! &FlowGenCanvas.NFT
      }
      return nil
    }
    
    // Borrow an NFT as a ViewResolver.Resolver
    access(all) fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver} {
      let nft = &self.ownedNFTs[id] as auth(FlowGenCanvas.Withdraw) &NonFungibleToken.NFT
        ?? panic("NFT not found in collection")
      let pixel = nft as! &FlowGenCanvas.NFT
      return pixel
    }
    
    // Get supported NFT types
    access(all) view fun getSupportedNFTTypes(): {Type: Bool} {
      let types: {Type: Bool} = {}
      types[Type<@FlowGenCanvas.NFT>()] = true
      return types
    }
    
    // Check if type is supported
    access(all) view fun isSupportedNFTType(type: Type): Bool {
      return type == Type<@FlowGenCanvas.NFT>()
    }
    
    // Get the length of the collection
    access(all) view fun getLength(): Int {
      return self.ownedNFTs.length
    }
    
    // Iterate over NFT IDs
    access(all) fun forEachID(_ f: fun(UInt64): Bool) {
      for id in self.getIDs() {
        if !f(id) {
          break
        }
      }
    }
    
    // Create empty collection (required by NonFungibleToken.Collection interface)
    access(all) fun createEmptyCollection(): @NonFungibleToken.Collection {
      return <- create Collection()
    }
  }
  
  // Admin resource that can mint NFTs and manage the contract
  access(all) resource Admin {
    // Mint a new NFT
    access(all) fun mintNFT(
      recipient: &{NonFungibleToken.CollectionPublic},
      x: UInt16,
      y: UInt16,
      width: UInt16,
      height: UInt16,
      imageURL: String,
      prompt: String,
      style: String
    ) {
      // Validate coordinates
      pre {
        x < FlowGenCanvas.canvasWidth: "X coordinate out of bounds"
        y < FlowGenCanvas.canvasHeight: "Y coordinate out of bounds"
        x + width <= FlowGenCanvas.canvasWidth: "Width exceeds canvas bounds"
        y + height <= FlowGenCanvas.canvasHeight: "Height exceeds canvas bounds"
      }
      
      // Check all pixels in the rectangle are available
      var i = x
      while i < x + width {
        var j = y
        while j < y + height {
          let key = i.toString().concat(",").concat(j.toString())
          if FlowGenCanvas.pixelGrid[key] != nil && FlowGenCanvas.pixelGrid[key]! {
            panic("Pixel at position (".concat(i.toString()).concat(",").concat(j.toString()).concat(") is already owned"))
          }
          j = j + 1
        }
        i = i + 1
      }
      
      // Calculate current price based on dynamic pricing algorithm
      let currentPrice = self.calculateCurrentPrice()
      
      // Mark all pixels in the rectangle as owned
      var mi = x
      while mi < x + width {
        var mj = y
        while mj < y + height {
          let key = mi.toString().concat(",").concat(mj.toString())
          FlowGenCanvas.pixelGrid[key] = true
          FlowGenCanvas.soldPixels = FlowGenCanvas.soldPixels + 1
          mj = mj + 1
        }
        mi = mi + 1
      }
      
      // Create the new NFT
      let newNFT <- create NFT(
        id: FlowGenCanvas.totalSupply,
        x: x,
        y: y,
        width: width,
        height: height,
        imageURL: imageURL,
        prompt: prompt,
        style: style,
        purchasePrice: currentPrice
      )
      
      // Increment the supply counter
      FlowGenCanvas.totalSupply = FlowGenCanvas.totalSupply + 1
      
      // Emit the mint event
      emit PixelMinted(
        id: newNFT.id,
        x: x,
        y: y,
        owner: recipient.owner!.address
      )
      
      // Deposit the NFT to the recipient's collection
      recipient.deposit(token: <-newNFT)
      
      // Update pricing based on new sold percentage
      self.updatePrice()
    }
    
    // Calculate the current price based on sold percentage
    access(all) view fun calculateCurrentPrice(): UFix64 {
      let soldPercentage = UFix64(FlowGenCanvas.soldPixels) / UFix64(FlowGenCanvas.totalPixels)
      
      // Price increases exponentially as more pixels are sold
      // Max price is 10x the base price when 100% sold
      let multiplier = 1.0 + 9.0 * soldPercentage
      return FlowGenCanvas.basePrice * multiplier
    }
    
    // Update the price based on the current state
    access(all) fun updatePrice() {
      let newPrice = self.calculateCurrentPrice()
      FlowGenCanvas.currentPrice = newPrice
      emit PriceUpdated(newPrice: newPrice)
    }
    
    // Admin can update the base price if needed
    access(all) fun updateBasePrice(newBasePrice: UFix64) {
      FlowGenCanvas.basePrice = newBasePrice
      self.updatePrice()
    }
  }
  
  // Public function to get current price
  access(all) view fun getCurrentPrice(): UFix64 {
    let soldPercentage = UFix64(self.soldPixels) / UFix64(self.totalPixels)
    let multiplier = 1.0 + 9.0 * soldPercentage
    return self.basePrice * multiplier
  }
  
  // Check if a specific pixel is available
  access(all) view fun isPixelAvailable(x: UInt16, y: UInt16): Bool {
    let key = x.toString().concat(",").concat(y.toString())
    return self.pixelGrid[key] == nil || !self.pixelGrid[key]!
  }
  
  // Create a new empty NFT Collection
  access(all) fun createEmptyCollection(): @NonFungibleToken.Collection {
    return <- create Collection()
  }
  
  init() {
    // Set storage paths
    self.CollectionStoragePath = /storage/FlowGenCanvasCollection
    self.CollectionPublicPath = /public/FlowGenCanvasCollection
    self.MinterStoragePath = /storage/FlowGenCanvasMinter
    self.AdminStoragePath = /storage/FlowGenCanvasAdmin
    
    // Initialize canvas dimensions (e.g., 1000x1000 pixels)
    self.canvasWidth = 1000
    self.canvasHeight = 1000
    
    // Initialize the pixel grid
    self.pixelGrid = {}
    
    // Set starting price (0.1 FLOW per pixel)
    self.basePrice = 0.1
    self.currentPrice = 0.1
    
    // Initialize total pixels and sold count
    self.totalPixels = UInt64(self.canvasWidth) * UInt64(self.canvasHeight)
    self.soldPixels = 0
    
    // Initialize NFT supply
    self.totalSupply = 0
    
    // Create admin resource and store it using new Storage API
    let admin <- create Admin()
    self.account.storage.save(<-admin, to: self.AdminStoragePath)
    
    emit ContractInitialized()
  }
}