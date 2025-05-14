import Test

access(all) let account = Test.createAccount()

access(all) fun testContract() {
    let err = Test.deployContract(
        name: "FlowGenCanvas",
        path: "../contracts/FlowGenCanvas.cdc",
        arguments: [],
    )

    Test.expect(err, Test.beNil())
}