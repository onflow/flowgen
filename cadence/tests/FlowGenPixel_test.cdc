import Test

access(all) let account = Test.createAccount()

access(all) fun testContract() {
    let err = Test.deployContract(
        name: "FlowGenPixel",
        path: "../contracts/FlowGenPixel.cdc",
        arguments: [],
    )

    Test.expect(err, Test.beNil())
}

access(all) fun testMintNFT() {
    // Setup: Get the deployed contract
    let contractAddress = Test.getAccount(Test.env.SERVICE_ACCOUNT_ADDRESS).contracts.get(name: "FlowGenPixel") ?? panic("Contract not deployed")
    
    let pixelContract = contractAddress as! &FlowGenPixel

    // Setup: Create a recipient account and a public receiver capability
    let recipientAccount = Test.createAccount()
    let receiverCap = recipientAccount.capabilities.get<&{NonFungibleToken.Receiver}>(FlowGenPixel.CollectionPublicPath)
    if !receiverCap.check() {
        // Setup collection for the recipient if it doesn't exist
        let txn = Test.prepareTransaction(
            signer: recipientAccount,
            code: """
                import NonFungibleToken from 0xNON_FUNGIBLE_TOKEN_ADDRESS
                import FlowGenPixel from 0xFLOWGEN_PIXEL_ADDRESS

                transaction {
                    prepare(signer: AuthAccount) {
                        if signer.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath) == nil {
                            signer.storage.save(<-FlowGenPixel.createEmptyCollection(nftType: Type<@FlowGenPixel.NFT>()), to: FlowGenPixel.CollectionStoragePath)
                            signer.capabilities.publish(
                                signer.capabilities.storageCapability<&FlowGenPixel.Collection>(FlowGenPixel.CollectionStoragePath)!,
                                at: FlowGenPixel.CollectionPublicPath
                            )
                        }
                    }
                }
            """.replace("0xNON_FUNGIBLE_TOKEN_ADDRESS", Test.getNonFungibleTokenAddress().toString())
             .replace("0xFLOWGEN_PIXEL_ADDRESS", contractAddress.address.toString())
        )
        Test.executeTransaction(txn)
        Test.expect(Test.getTransactionResult(txn)?.error, Test.beNil())
    }


    let minter = Test.getAccount(Test.env.SERVICE_ACCOUNT_ADDRESS).storage.borrow<&FlowGenPixel.NFTMinter>(from: FlowGenPixel.MinterStoragePath)
        ?? panic("Minter resource not found")

    let initialTotalSupply = pixelContract.totalSupply

    // Define NFT properties
    let name = "Test Pixel"
    let description = "A pixel for testing"
    let thumbnailURL = "https://example.com/thumb.png"
    let aiPrompt = "Test AI prompt"
    let imageURI = "https://example.com/image.png"
    let pixelArtURI = "https://example.com/pixel.png"
    let imageHash = "testhash123"
    let x: UInt16 = 10
    let y: UInt16 = 20
    let creatorAddress = Test.getAccount(Test.env.SERVICE_ACCOUNT_ADDRESS).address
    let royaltyRate: UFix64 = 0.1

    // Mint the NFT
    minter.mintPixelNFT(
        recipientCap: recipientAccount.capabilities.get<&{NonFungibleToken.Receiver}>(FlowGenPixel.CollectionPublicPath)!,
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

    // Assertions
    Test.expect(pixelContract.totalSupply, Test.equal(initialTotalSupply + 1), message: "Total supply should increment after minting")
    Test.expect(pixelContract.isPixelMinted(x: x, y: y), Test.beTrue(), message: "isPixelMinted should return true for the new pixel")
    
    let mintedID = pixelContract.getPixelNFTID(x: x, y: y)
    Test.expect(mintedID, Test.not(Test.beNil()), message: "getPixelNFTID should return a valid ID")

    // Check emitted event (This is a bit more involved with the current Test framework capabilities)
    // For now, we'll rely on the other checks. A more robust event check might require framework enhancements or custom scripts.

    // Verify NFT details in recipient's collection
    let collection = recipientAccount.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath)
        ?? panic("Recipient collection not found")
    
    let ids = collection.getIDs()
    Test.expect(ids.length, Test.equal(1), message: "Recipient collection should have one NFT")
    Test.expect(ids[0], Test.equal(mintedID!), message: "NFT ID in collection should match minted ID")

    let nft = collection.borrowNFT(mintedID!) as! &FlowGenPixel.NFT?
        ?? panic("NFT not found in collection")

    Test.expect(nft.name, Test.equal(name))
    Test.expect(nft.x, Test.equal(x))
    Test.expect(nft.y, Test.equal(y))
}