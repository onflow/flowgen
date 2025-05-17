// FlowGenCanvas.cdc
// This contract provides views and information about the FlowGenPixel canvas.

// Import the NFT contract to call its public functions
// Assuming FlowGenPixel.cdc is in the same directory or path is resolved by flow.json
import "FlowGenPixel" // Changed to named import

access(all) contract FlowGenCanvas {

    access(all) let canvasWidth: UInt16
    access(all) let canvasHeight: UInt16
    access(all) let totalPixels: UInt64 // Added field

    // Event to indicate canvas initialization (optional, but good practice)
    access(all) event ContractInitialized(width: UInt16, height: UInt16, totalPixels: UInt64)

    access(all) view fun isPixelTaken(x: UInt16, y: UInt16): Bool {
        pre {
            x < self.canvasWidth : "X-coordinate out of bounds"
            y < self.canvasHeight : "Y-coordinate out of bounds"
        }
        return FlowGenPixel.isPixelMinted(x: x, y: y)
    }

    access(all) view fun getNFTIDForPixel(x: UInt16, y: UInt16): UInt64? {
        pre {
            x < self.canvasWidth : "X-coordinate out of bounds"
            y < self.canvasHeight : "Y-coordinate out of bounds"
        }
        return FlowGenPixel.getPixelNFTID(x: x, y: y)
    }

    access(all) view fun getSoldPixels(): UInt64 {
        return FlowGenPixel.totalSupply
    }

    // Placeholder for current price - adjust as per your pricing model
    access(all) view fun getCurrentPrice(): UFix64 {
        return 10.0 // Example: 10.0 FLOW
    }

    init() {
        // These should ideally match FlowGenPixel.CanvasResolution if it were publicly readable
        // or passed in during deployment.
        // For now, using the known constant from FlowGenPixel.cdc.
        // A more robust solution would be to make FlowGenPixel.CanvasResolution public
        // or pass these as arguments to FlowGenCanvas init during deployment.
        // Example: let res = FlowGenPixel.getCanvasResolution() -> returns a struct {width: UInt16, height: UInt16}
        // For now, we assume it's "1024x1024"
        
        // This is a simplistic way to set these; ideally, they are configured robustly.
        let initialCanvasWidth: UInt16 = 16 
        let initialCanvasHeight: UInt16 = 16
        
        self.canvasWidth = initialCanvasWidth
        self.canvasHeight = initialCanvasHeight
        self.totalPixels = UInt64(self.canvasWidth) * UInt64(self.canvasHeight)
        
        emit ContractInitialized(width: self.canvasWidth, height: self.canvasHeight, totalPixels: self.totalPixels)
    }
}