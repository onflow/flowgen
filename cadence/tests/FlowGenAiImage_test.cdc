import Test

access(all) let account = Test.createAccount()

access(all) fun testContract() {
    let err = Test.deployContract(
        name: "FlowGenAiImage",
        path: "../contracts/FlowGenAiImage.cdc",
        arguments: [],
    )

    Test.expect(err, Test.beNil())
}