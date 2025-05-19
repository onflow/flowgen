import Test
import "FlowGenPixel"

access(all) fun setup(): Address {
    let account = Test.createAccount()
    let err = Test.deployContract(
        name: "FlowGenAiImage",
        path: "../contracts/FlowGenAiImage.cdc",
        arguments: []
    )
    let err2 = Test.deployContract(
        name: "FlowGenPixel",
        path: "../contracts/FlowGenPixel.cdc",
        arguments: []
    )
    Test.expect(err, Test.beNil())
    return account.address
}

access(all) fun testGetPixelPrice_EdgeTier() {
    // Setup: Deploy contracts
    let contractAccountAddress = setup()

    // Define script path and arguments
    let scriptPath = "../scripts/GetPixelPrice.cdc"
    let x: UInt16 = 0
    let y: UInt16 = 0
    let args: [AnyStruct] = [x, y]

    // Execute the script
    let result = Test.executeScript(scriptPath, args)
    
    // Assertions
    Test.expect(result.status, Test.beSucceeded())
    
    let expectedPrice: UFix64 = 10.0
    let actualPrice = result.returnValue! as! UFix64
    
    Test.assertEqual(expectedPrice, actualPrice)
    log("TestGetPixelPrice_EdgeTier PASSED: Price for (0,0) is ".concat(actualPrice.toString()))
}

access(all) fun testGetPixelPrice_CenterTier() {
    // Setup: Deploy contracts (implicitly handled by test runner if tests are separate, or call setup() again)
    // For simplicity here, we assume setup() might be implicitly run or we just care about a fresh deploy for the test logic itself.
    // If these tests run sequentially in one environment, contract state (like totalPixelsSold) from previous tests could interfere
    // unless the contract is redeployed or reset. The current setup() deploys to a new account each time it's called,
    // which isolates contract deployments if called per test function.
    let contractAccountAddress = setup() // Ensures fresh deployment for this test logic

    let scriptPath = "../scripts/GetPixelPrice.cdc"
    let x: UInt16 = 7
    let y: UInt16 = 7 // Should be center tier based on 16x16 canvas, 0.33 threshold
    let args: [AnyStruct] = [x, y]

    let result = Test.executeScript( scriptPath, args)

    Test.expect(result.status, Test.beSucceeded())

    let expectedPrice: UFix64 = 40.0 
    let actualPrice = result.returnValue! as! UFix64

    Test.assertEqual(expectedPrice, actualPrice)
    log("TestGetPixelPrice_CenterTier PASSED: Price for (7,7) is ".concat(actualPrice.toString()))
}
