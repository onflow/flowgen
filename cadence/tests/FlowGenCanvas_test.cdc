import Test
import "FlowGenPixel" // Or named import "FlowGenPixel"
import "FlowGenCanvas" // Or named import "FlowGenCanvas"
import "NonFungibleToken"
import "FungibleToken"
import "MetadataViews"

access(all) fun testFlowGenCanvasDeploymentAndInitialState() {
    Test.assertEqual(UInt16(1024), FlowGenCanvas.canvasWidth)
    Test.assertEqual(UInt16(1024), FlowGenCanvas.canvasHeight)
    Test.assertEqual(UInt64(1024*1024), FlowGenCanvas.totalPixels)
    Test.assertEqual(UInt64(0), FlowGenCanvas.getSoldPixels())
    Test.assertEqual(10.0, FlowGenCanvas.getCurrentPrice())
    log("FlowGenCanvas deployment and initial state check successful")
}

access(all) fun testCanvasPixelQueries() {
    let admin = Test.getAccount("admin") // Replace with actual admin account alias/address
    let user1 = Test.getAccount("user-one")   // Replace with actual user account alias/address

    let x: UInt16 = 5
    let y: UInt16 = 5

    // Initially, pixel should not be taken
    Test.assertEqual(false, FlowGenCanvas.isPixelTaken(x: x, y: y), message: "Pixel 5,5 should initially not be taken")
    Test.assertEqual(nil, FlowGenCanvas.getNFTIDForPixel(x: x, y: y), message: "Pixel 5,5 should initially have no NFT ID")

    // Setup collection for user1 for FlowGenPixel
    if user1.storage.borrow<&FlowGenPixel.Collection>(from: FlowGenPixel.CollectionStoragePath) == nil {
         let setupCollectionTx = Test.Transaction(
            code: readFile("../transactions/PurchasePixel.cdc"), // Ensure this path is correct and file is updated for FlowGenPixel
            signers: [user1]
        )
        Test.expect(Test.execute(setupCollectionTx), Test.beSucceeded(), message: "Failed to setup FlowGenPixel collection for user1")
    }
    
    // Setup royalty receiver for user1 (creator)
    let royaltyPath = MetadataViews.getRoyaltyReceiverPublicPath()
    if !user1.capabilities.get<&{FungibleToken.Receiver}>(royaltyPath).check() {
        let setupRoyaltyTx = Test.Transaction(
            code: """
                import FungibleToken from "FungibleToken"
                import MetadataViews from "MetadataViews"
                transaction {
                    prepare(signer: AuthAccount) {
                        if signer.storage.borrow<&FungibleToken.Vault>(from: /storage/flowTokenVault) == nil {
                            signer.storage.save(<-FungibleToken.createEmptyVault(vaultType: Type<@FungibleToken.Vault>()), to: /storage/flowTokenVault)
                            signer.capabilities.publish(
                                signer.capabilities.storage.issue<&{FungibleToken.Receiver}>(/storage/flowTokenVault),
                                at: /public/flowTokenReceiver
                            )
                        }
                        if !signer.capabilities.get<&{FungibleToken.Receiver}>(MetadataViews.getRoyaltyReceiverPublicPath()).check() {
                             signer.capabilities.publish(
                                signer.capabilities.storage.issue<&{FungibleToken.Receiver}>(/storage/flowTokenVault),
                                at: MetadataViews.getRoyaltyReceiverPublicPath()
                            )
                        }
                    }
                }
            """,
            signers: [user1]
        )
        Test.expect(Test.execute(setupRoyaltyTx), Test.beSucceeded(), message: "Failed to setup royalty receiver for user1")
    }
    
    let user1PixelReceiverCap = user1.capabilities.get<&{NonFungibleToken.Receiver}>(FlowGenPixel.CollectionPublicPath)
        ?? panic("User1 FlowGenPixel Collection receiver capability not found or invalid.")
    if !user1PixelReceiverCap.check() { panic("User1 FlowGenPixel Collection receiver capability invalid check")}

    // Mint a pixel using the admin account and FlowGenPixel.NFTMinter
    let mintTx = Test.Transaction(
        code: """
            import NonFungibleToken from "NonFungibleToken"
            import FlowGenPixel from "FlowGenPixel" // Named import
            transaction(
                recipientCap: Capability<&{NonFungibleToken.Receiver}>, 
                xCoord: UInt16, yCoord: UInt16, 
                creator: Address
            ) {
                prepare(adminAcct: AuthAccount) {
                    let minter = adminAcct.storage.borrow<&FlowGenPixel.NFTMinter>(from: FlowGenPixel.MinterStoragePath)
                        ?? panic("Admin account is missing the NFTMinter resource.")
                    minter.mintPixelNFT(
                        recipientCap: recipientCap, 
                        name: "CanvasTestPixel", description: "Testing canvas queries", thumbnailURL: "http://example.com/ct.png",
                        aiPrompt: "canvas test", imageURI: "ipfs://canvastest", pixelArtURI: "ipfs://canvastestart", imageHash: "hashcanvas",
                        x: xCoord, y: yCoord, 
                        creatorAddress: creator, royaltyRate: 0.02 // Example royalty for this test mint
                    )
                }
            }
        """,
        args: [user1PixelReceiverCap, x, y, user1.address],
        signers: [admin]
    )
    Test.expect(Test.execute(mintTx), Test.beSucceeded(), message: "Minting pixel for canvas query test failed.")
    
    Test.assertEqual(true, FlowGenCanvas.isPixelTaken(x: x, y: y), message: "Pixel 5,5 should now be taken after mint")
    let nftID = FlowGenCanvas.getNFTIDForPixel(x: x, y: y)
    Test.assertNotEqual(nil, nftID, message: "Pixel 5,5 should now have an NFT ID after mint")
    Test.assertEqual(UInt64(1), FlowGenCanvas.getSoldPixels(), message: "Sold pixels count should be 1 (assuming fresh state or only one mint)")

    log("FlowGenCanvas pixel query functions work correctly after minting.")
}

access(all) fun runAll() {
    Test.Blockchain.snapshot()
    log("========= Running FlowGenCanvas Tests =========")

    // Ensure dependent contracts are deployed; often handled by emulator config or a global test setup.
    // For FlowGenCanvas tests to run, FlowGenPixel must be deployed and its admin must have the Minter.
    let admin = Test.getAccount(0xadmin) // Replace with actual admin account alias/address
    if admin.storage.borrow<&FlowGenPixel.NFTMinter>(from: FlowGenPixel.MinterStoragePath) == nil {
        panic("CRITICAL: Admin for FlowGenPixel must have NFTMinter. Ensure FlowGenPixel deployed correctly.")
    }

    Test.run(testFlowGenCanvasDeploymentAndInitialState)
    Test.run(testCanvasPixelQueries) // This test has dependencies on user account setup and admin minting

    log("========= FlowGenCanvas Tests Completed =========")
    Test.Blockchain.revert()
}