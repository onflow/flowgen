// InitializeCanvasBackground.cdc
// Transaction to be run by the CanvasBackground contract deployer
// to mint the very first historical background NFT.

import "CanvasBackground"

transaction(initialImageHash: String) {

    let adminRef: &CanvasBackground.Admin

    prepare(signer: auth(Storage) &Account) {
        // Borrow a reference to the Admin resource in the signer's storage.
        self.adminRef = signer.storage.borrow<&CanvasBackground.Admin>(from: CanvasBackground.AdminStoragePath)
            ?? panic("Could not borrow a reference to the CanvasBackground Admin resource from signer's storage")
    }

    execute {
        // Mint the first historical background NFT.
        // triggeringPixelID, triggeringEventTransactionID, and triggeringAiImageID are nil for the initial state.
        let firstBackgroundNFT <- self.adminRef.mintNewBackground(
            imageHash: initialImageHash,
            triggeringPixelID: nil,
            triggeringEventTransactionID: nil,
            triggeringAiImageID: nil
        )

        // The mintNewBackground function emits the NewBackgroundMinted event
        // and updates CanvasBackground.latestBackgroundNftID and CanvasBackground.currentVersionNumber.

        // We have the @NFT resource here (firstBackgroundNFT).
        // For this initialization, if we don't need to store it in a specific collection
        // immediately via this transaction, we can simply destroy it.
        // The important part is that the contract's state (latestBackgroundNftID) is set.
        destroy firstBackgroundNFT

        log("CanvasBackground initialized: First background NFT minted and contract state updated.")
    }
} 