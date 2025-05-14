import Test

access(all) let account = Test.createAccount()

access(all) fun testContract() {
    let err = Test.deployContract(
        name: "FooBar",
        path: "../contracts/FooBar.cdc",
        arguments: [],
    )

    Test.expect(err, Test.beNil())
}