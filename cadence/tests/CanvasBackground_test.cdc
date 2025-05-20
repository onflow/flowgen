import Test

access(all) let account = Test.createAccount()

access(all) fun testContract() {
    let err = Test.deployContract(
        name: "CanvasBackground",
        path: "../contracts/CanvasBackground.cdc",
        arguments: [],
    )

    Test.expect(err, Test.beNil())
}