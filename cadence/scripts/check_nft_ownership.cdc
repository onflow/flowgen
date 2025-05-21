    // check_nft_ownership.cdc
    import NonFungibleToken from "NonFungibleToken"
    import CanvasBackground from "CanvasBackground"

    access(all) fun main(accountAddress: Address, expectedNftID: UInt64): Bool {
        let account = getAccount(accountAddress)

        // Attempt to borrow the public collection capability
        let collectionCap: Capability<&{NonFungibleToken.CollectionPublic}> = account.capabilities.get<&{NonFungibleToken.CollectionPublic}>(
            CanvasBackground.CollectionPublicPath
        )

        if !collectionCap.check() {
            log("Could not borrow collection capability from account: ".concat(accountAddress.toString()))
            return false
        }

        let collectionRef: &{NonFungibleToken.CollectionPublic} = collectionCap.borrow()
            ?? panic("Failed to borrow reference from collection capability after check.")

        // Option 1: Check using getIDs()
        let ids = collectionRef.getIDs()
        for id in ids {
            if id == expectedNftID {
                log("NFT ID ".concat(expectedNftID.toString()).concat(" found in collection via getIDs()."))
                return true
            }
        }
        
        // Option 2 (more direct): Try to borrow the specific NFT
        // If borrowNFT returns a reference, the ID is in the collection.
        // let nftRef = collectionRef.borrowNFT(id: expectedNftID) // Assuming no label for id
        // if nftRef != nil {
        //     log("NFT ID ".concat(expectedNftID.toString()).concat(" found in collection via borrowNFT()."))
        //     return true
        // }


        log("NFT ID ".concat(expectedNftID.toString()).concat(" NOT found in the collection of account ").concat(accountAddress.toString()))
        return false
    }