// FlowGenPixelMarketplace.cdc
// A simple marketplace contract for FlowGenPixel NFTs with automatic 25% markup

import "NonFungibleToken"
import "FungibleToken" 
import "FlowGenPixel"
import "FlowGenAiImage"
import "MetadataViews"

access(all) contract FlowGenPixelMarketplace {

    // Event definitions
    access(all) event PixelListed(pixelId: UInt64, price: UFix64, seller: Address)
    access(all) event PixelPurchased(pixelId: UInt64, price: UFix64, seller: Address, buyer: Address)
    access(all) event PixelDelisted(pixelId: UInt64, seller: Address)
    access(all) event MarketplaceInitialized()

    // Storage paths
    access(all) let ListingStoragePath: StoragePath
    access(all) let ListingPublicPath: PublicPath

    // Fixed markup percentage (25%)
    access(all) let RESALE_MARKUP: UFix64

    // Structure to hold listing information
    access(all) struct ListingInfo {
        access(all) let pixelId: UInt64
        access(all) let price: UFix64
        access(all) let seller: Address
        access(all) let x: UInt16
        access(all) let y: UInt16
        access(all) let originalPurchasePrice: UFix64

        init(pixelId: UInt64, price: UFix64, seller: Address, x: UInt16, y: UInt16, originalPurchasePrice: UFix64) {
            self.pixelId = pixelId
            self.price = price
            self.seller = seller
            self.x = x
            self.y = y
            self.originalPurchasePrice = originalPurchasePrice
        }
    }

    // Interface for public listing operations
    access(all) resource interface ListingPublic {
        access(all) view fun getListingInfo(pixelId: UInt64): ListingInfo?
        access(all) view fun getAllListings(): [ListingInfo]
        access(all) fun purchasePixel(
            pixelId: UInt64,
            payment: @{FungibleToken.Vault},
            buyerCollection: &{NonFungibleToken.Collection}
        )
    }

    // Listing manager resource that each seller has
    access(all) resource ListingManager: ListingPublic {
        // Track listings by pixel ID
        access(self) var listings: {UInt64: ListingInfo}
        
        // Reference to owner's pixel collection
        access(self) let ownerCollectionCap: Capability<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>

        init(collectionCap: Capability<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>) {
            self.listings = {}
            self.ownerCollectionCap = collectionCap
        }

        // List a pixel for sale with automatic 25% markup
        access(all) fun listPixelForSale(pixelId: UInt64, originalPurchasePrice: UFix64) {
            let collection = self.ownerCollectionCap.borrow()
                ?? panic("Could not borrow owner's collection")
            
            // Verify the seller owns the pixel
            let nftRef = collection.borrowNFT(pixelId)
                ?? panic("Pixel NFT not found in seller's collection")
            
            let pixelRef = nftRef as! &FlowGenPixel.NFT
            
            // Calculate sale price with 25% markup
            let salePrice = originalPurchasePrice * (1.0 + FlowGenPixelMarketplace.RESALE_MARKUP)
            
            let listing = ListingInfo(
                pixelId: pixelId,
                price: salePrice,
                seller: self.owner!.address,
                x: pixelRef.x,
                y: pixelRef.y,
                originalPurchasePrice: originalPurchasePrice
            )
            
            self.listings[pixelId] = listing
            
            emit PixelListed(pixelId: pixelId, price: salePrice, seller: self.owner!.address)
        }

        // Remove a listing
        access(all) fun delistPixel(pixelId: UInt64) {
            self.listings.remove(key: pixelId)
                ?? panic("Pixel not listed")
            
            emit PixelDelisted(pixelId: pixelId, seller: self.owner!.address)
        }

        // Get listing information
        access(all) view fun getListingInfo(pixelId: UInt64): ListingInfo? {
            return self.listings[pixelId]
        }

        // Get all listings for this seller
        access(all) view fun getAllListings(): [ListingInfo] {
            return self.listings.values
        }

        // Purchase a listed pixel
        access(all) fun purchasePixel(
            pixelId: UInt64,
            payment: @{FungibleToken.Vault},
            buyerCollection: &{NonFungibleToken.Collection}
        ) {
            let listing = self.listings[pixelId]
                ?? panic("Pixel not listed for sale")
            
            // Verify payment amount
            if payment.balance != listing.price {
                panic("Payment amount (".concat(payment.balance.toString()).concat(") does not match listing price (").concat(listing.price.toString()).concat(")"))
            }

            // Get seller's collection to withdraw the NFT
            let sellerCollection = self.ownerCollectionCap.borrow()
                ?? panic("Could not borrow seller's collection")
            
            // Withdraw the pixel NFT from seller
            let nft <- sellerCollection.withdraw(withdrawID: pixelId)
            
            // Get the pixel NFT reference to access aiImageNftID
            let pixelRef = (&nft as &{NonFungibleToken.NFT}) as! &FlowGenPixel.NFT
            let aiImageNftID = pixelRef.aiImageNftID
            
            // Deposit NFT to buyer
            buyerCollection.deposit(token: <-nft)
            
            // Handle payment distribution
            self.distributePayment(payment: <-payment, aiImageNftID: aiImageNftID, listingPrice: listing.price)
            
            // Remove listing
            self.listings.remove(key: pixelId)
            
            emit PixelPurchased(
                pixelId: pixelId,
                price: listing.price,
                seller: listing.seller,
                buyer: buyerCollection.owner!.address
            )
        }

        // Distribute payment including royalties
        access(self) fun distributePayment(payment: @{FungibleToken.Vault}, aiImageNftID: UInt64, listingPrice: UFix64) {
            // Get AI Image collection to check royalties
            let aiImageCollectionRef = getAccount(self.owner!.address)
                .capabilities.borrow<&{NonFungibleToken.Collection}>(FlowGenAiImage.CollectionPublicPath)
            
            var royaltyAmount = 0.0
            var royaltyReceiverAddress: Address? = nil
            
            // Try to get royalty info from the AI Image NFT
            if let collection = aiImageCollectionRef {
                if let nftRef = collection.borrowNFT(aiImageNftID) {
                    if let royaltyView = nftRef.resolveView(Type<MetadataViews.Royalties>()) {
                        if let royalties = royaltyView as? MetadataViews.Royalties {
                            // Assume first royalty is the creator royalty
                            if royalties.getRoyalties().length > 0 {
                                let royalty = royalties.getRoyalties()[0]
                                royaltyAmount = listingPrice * royalty.cut
                                royaltyReceiverAddress = royalty.receiver.address
                            }
                        }
                    }
                }
            }
            
            // Pay royalty if applicable
            if royaltyAmount > 0.0 && royaltyReceiverAddress != nil {
                let royaltyPayment <- payment.withdraw(amount: royaltyAmount)
                let royaltyReceiver = getAccount(royaltyReceiverAddress!)
                    .capabilities.borrow<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                    ?? panic("Could not borrow royalty receiver")
                royaltyReceiver.deposit(from: <-royaltyPayment)
            }
            
            // Pay seller the remaining amount
            let sellerReceiver = getAccount(self.owner!.address)
                .capabilities.borrow<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                ?? panic("Could not borrow seller's Flow token receiver")
            
            sellerReceiver.deposit(from: <-payment)
        }
    }

    // Create a new ListingManager
    access(all) fun createListingManager(
        collectionCap: Capability<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>
    ): @ListingManager {
        return <- create ListingManager(collectionCap: collectionCap)
    }

    // Get all active listings across all sellers
    access(all) fun getAllActiveListings(): [ListingInfo] {
        let listings: [ListingInfo] = []
        
        // This is a simplified approach - in production, you'd want to maintain
        // a registry of all listing managers or use events to track listings
        // For now, this assumes you'll query specific seller addresses
        
        return listings
    }

    // Check if a specific pixel is listed by querying the seller's listing manager
    access(all) fun isPixelListed(sellerAddress: Address, pixelId: UInt64): Bool {
        let listingCap = getAccount(sellerAddress)
            .capabilities.borrow<&{ListingPublic}>(self.ListingPublicPath)
        
        if let listingManager = listingCap {
            return listingManager.getListingInfo(pixelId: pixelId) != nil
        }
        
        return false
    }

    init() {
        self.RESALE_MARKUP = 0.25 // 25% markup
        
        self.ListingStoragePath = /storage/flowGenPixelMarketplaceListing
        self.ListingPublicPath = /public/flowGenPixelMarketplaceListing
        
        emit MarketplaceInitialized()
    }
}