// File: /Users/tom/code/flowgen/cadence/scripts/GetUserPixelNFTs.cdc
import "NonFungibleToken"
import "FlowGenPixel"

// This script returns an array of FlowGenPixel NFT IDs owned by an account.
access(all) fun main(accountAddress: Address): [UInt64] {
    let account = getAccount(accountAddress)

    // Attempt to borrow a reference to the public NFT collection using Capability Controllers
    // The CollectionPublicPath should be defined in the FlowGenPixel contract
    let capability = account.capabilities.get<&{NonFungibleToken.CollectionPublic}>(
        FlowGenPixel.CollectionPublicPath
    )

    if !capability.check() {
        // Account does not have the capability or it's not valid
        // It could also mean the account hasn't set up a FlowGenPixel collection
        return []
    }

    let collectionRef = capability.borrow()
        ?? panic("Failed to borrow reference from a valid capability. This account may not have a FlowGenPixel collection or it's not published at the expected public path.")

    // Get the NFT IDs
    let nftIDs = collectionRef.getIDs()

    return nftIDs
} 