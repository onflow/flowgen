import Test

access(all) let CANVAS_WIDTH: UInt16 = 16 // Example
access(all) let CANVAS_HEIGHT: UInt16   = 16 // Example
access(all) let MAX_SUPPLY: UInt64 = UInt64(CANVAS_WIDTH) * UInt64(CANVAS_HEIGHT)

access(all) let BASE_PRICE: UFix64 = 10.0 // e.g., 10 FLOW for edge pixels
access(all) let MID_TIER_PRICE_MULTIPLIER: UFix64 = 2.0
access(all) let CENTER_TIER_PRICE_MULTIPLIER: UFix64 = 4.0
access(all) let MID_TIER_THRESHOLD_PERCENT: UFix64 = 0.33 // Inner 33% of (max) Manhattan distance = Center Tier
access(all) let EDGE_TIER_THRESHOLD_PERCENT: UFix64 = 0.66 // Next 33% (up to 66% of max) = Mid Tier, >66% = Edge Tier
access(all) let SCARCITY_PREMIUM_FACTOR: UFix64 = 20.0 // Price can triple due to scarcity

access(all) fun setup() {
    let account: Test.TestAccount = Test.createAccount()
    let err: Test.Error? = Test.deployContract(
        name: "PixelPriceCalculator",
        path: "../contracts/PixelPriceCalculator.cdc",
        arguments: []
    )
    
    Test.expect(err, Test.beNil())
}
access(all) fun testGetPixelPrice_EdgeTier() {
    // Define script path and arguments
    let scriptCode: String = Test.readFile("../scripts/CalculatePixelPrice.cdc")
    let x: UInt16 = 0
    let y: UInt16 = 0
    let totalSold: UInt64 = 0
    let args: [AnyStruct] = [x, y, CANVAS_WIDTH, CANVAS_HEIGHT, BASE_PRICE, MID_TIER_PRICE_MULTIPLIER, CENTER_TIER_PRICE_MULTIPLIER, MID_TIER_THRESHOLD_PERCENT, EDGE_TIER_THRESHOLD_PERCENT, MAX_SUPPLY, totalSold, SCARCITY_PREMIUM_FACTOR]

    // Execute the script
    let result: Test.ScriptResult = Test.executeScript(scriptCode, args)

    // Assertions
    Test.expect(result, Test.beSucceeded())
    
    let expectedPrice: UFix64 = BASE_PRICE
    let actualPrice = result.returnValue! as! UFix64
    
    Test.assertEqual(expectedPrice, actualPrice)
    log("TestGetPixelPrice_EdgeTier PASSED: Price for (0,0) is ".concat(actualPrice.toString()))
}

access(all) fun testGetPixelPrice_MiddleTier() {
    // Setup: Deploy contracts (implicitly handled by test runner if tests are separate, or call setup() again)
    // For simplicity here, we assume setup() might be implicitly run or we just care about a fresh deploy for the test logic itself.
    // If these tests run sequentially in one environment, contract state (like totalPixelsSold) from previous tests could interfere
    // unless the contract is redeployed or reset. The current setup() deploys to a new account each time it's called,
    // which isolates contract deployments if called per test function.

    let scriptCode: String = Test.readFile("../scripts/CalculatePixelPrice.cdc")
    let x: UInt16 = 3
    let y: UInt16 = 3 // Should be center tier based on 16x16 canvas, 0.33 threshold
    let totalSold: UInt64 = 0

    let args: [AnyStruct] = [x, y, CANVAS_WIDTH, CANVAS_HEIGHT, BASE_PRICE, MID_TIER_PRICE_MULTIPLIER, CENTER_TIER_PRICE_MULTIPLIER, MID_TIER_THRESHOLD_PERCENT, EDGE_TIER_THRESHOLD_PERCENT, MAX_SUPPLY, totalSold, SCARCITY_PREMIUM_FACTOR]

    let result: Test.ScriptResult = Test.executeScript( scriptCode, args)
  
    Test.expect(result, Test.beSucceeded())

    let expectedPrice: UFix64 = BASE_PRICE * MID_TIER_PRICE_MULTIPLIER
    let actualPrice: UFix64  = result.returnValue as! UFix64

    Test.assertEqual(expectedPrice, actualPrice)
    log("TestGetPixelPrice_CenterTier PASSED: Price for (3,3) is ".concat(actualPrice.toString()))
}

access(all) fun testGetPixelPrice_CenterTier() {
    // Setup: Deploy contracts (implicitly handled by test runner if tests are separate, or call setup() again)
    // For simplicity here, we assume setup() might be implicitly run or we just care about a fresh deploy for the test logic itself.
    // If these tests run sequentially in one environment, contract state (like totalPixelsSold) from previous tests could interfere
    // unless the contract is redeployed or reset. The current setup() deploys to a new account each time it's called,
    // which isolates contract deployments if called per test function.

    let scriptCode: String = Test.readFile("../scripts/CalculatePixelPrice.cdc")
    let x: UInt16 = 7
    let y: UInt16 = 7 // Should be center tier based on 16x16 canvas, 0.33 threshold
    let totalSold: UInt64 = 0
    let args: [AnyStruct] = [x, y, CANVAS_WIDTH, CANVAS_HEIGHT, BASE_PRICE, MID_TIER_PRICE_MULTIPLIER, CENTER_TIER_PRICE_MULTIPLIER, MID_TIER_THRESHOLD_PERCENT, EDGE_TIER_THRESHOLD_PERCENT, MAX_SUPPLY, totalSold, SCARCITY_PREMIUM_FACTOR]

    let result: Test.ScriptResult = Test.executeScript( scriptCode, args)
  
    Test.expect(result, Test.beSucceeded())

    let expectedPrice: UFix64 = BASE_PRICE * CENTER_TIER_PRICE_MULTIPLIER
    let actualPrice: UFix64  = result.returnValue as! UFix64

    Test.assertEqual(expectedPrice, actualPrice)
    log("TestGetPixelPrice_CenterTier PASSED: Price for (7,7) is ".concat(actualPrice.toString()))
}
