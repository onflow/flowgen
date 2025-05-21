// cadence/transactions/aiImage/UpdateAiImagePlatformRoyaltyAddress.cdc
import FlowGenAiImage from "FlowGenAiImage"

transaction(newAddress: Address) {
    
    let adminRef: &FlowGenAiImage.Admin

    prepare(signer: auth(Storage) &Account) {
        // Borrow the Admin resource from the signer's account
        // This path must match the AdminStoragePath used in FlowGenAiImage.cdc init()
        self.adminRef = signer.storage.borrow<&FlowGenAiImage.Admin>(from: FlowGenAiImage.AdminStoragePath)
            ?? panic("Could not borrow Admin resource from signer's account. Path: ".concat(FlowGenAiImage.AdminStoragePath.toString()))
    }

    execute {
        self.adminRef.updatePlatformRoyaltyAddress(newAddress: newAddress)
        log("Transaction executed: platformRoyaltyReceiverAddress update attempted.")
    }
} 