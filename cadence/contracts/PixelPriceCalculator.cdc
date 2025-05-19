// cadence/contracts/PixelPriceCalculator.cdc
// This contract acts as a library to provide pixel price calculation logic.

access(all) contract PixelPriceCalculator {

    // Calculates the price of a pixel based on provided parameters.
    // This version uses a smooth dynamic pricing model based on distance from the center.
    access(all) view fun calculatePrice(
        x: UInt16,
        y: UInt16,
        canvasWidth: UInt16,
        canvasHeight: UInt16,
        basePrice: UFix64,
        maxSupply: UInt64,
        totalPixelsSold: UInt64,
        centerMaxPriceTargetMultiplier: UFix64,
        scarcityPremiumFactor: UFix64
    ): UFix64 {

        // --- Location-based price multiplier calculation ---

        // Define the maximum price multiplier for the absolute center of the canvas

        var locationPriceMultiplier: UFix64 = 1.0

        if canvasWidth == 0 || canvasHeight == 0  {
            // For a degenerate canvas (0 width or height), default to base multiplier.
            locationPriceMultiplier = 1.0 
        } else {
            // Calculate true center coordinates for a 0-indexed grid.
            // E.g., for width 3 (indices 0,1,2), center is 1.0.
            // E.g., for width 4 (indices 0,1,2,3), center is 1.5.
            let gridCenterX = (UFix64(canvasWidth) - 1.0) / 2.0
            let gridCenterY = (UFix64(canvasHeight) - 1.0) / 2.0

            // Convert input pixel coordinates (assumed 0-indexed) to UFix64
            let pixelX = UFix64(x)
            let pixelY = UFix64(y)
            
            // Calculate Manhattan distance from the pixel to the grid's true center
            let distToCenterX = (pixelX > gridCenterX) ? (pixelX - gridCenterX) : (gridCenterX - pixelX)
            let distToCenterY = (pixelY > gridCenterY) ? (pixelY - gridCenterY) : (gridCenterY - pixelY)
            let manhattanDistFromCenter = distToCenterX + distToCenterY

            // Calculate the maximum possible Manhattan distance from the center to any corner.
            // This is (gridCenterX + gridCenterY) for a 0-indexed system where (0,0) is a corner.
            let maxDistInCanvas = gridCenterX + gridCenterY

            if maxDistInCanvas == 0.0 { 
                // This occurs if and only if canvasWidth = 1 and canvasHeight = 1.
                // The single pixel is the center.
                locationPriceMultiplier = centerMaxPriceTargetMultiplier
            } else {
                // normalizedManhattanDist: 0.0 for the exact center, 1.0 for the farthest corners.
                let normalizedManhattanDist = manhattanDistFromCenter / maxDistInCanvas
                
                // Linear interpolation for the multiplier:
                // Goes from centerMaxPriceTargetMultiplier (at normalizedDist=0, i.e. center) 
                // down to 1.0 (at normalizedDist=1, i.e. edge/corner)
                locationPriceMultiplier = 1.0 + (centerMaxPriceTargetMultiplier - 1.0) * (1.0 - normalizedManhattanDist)
            }
        }
        
        let priceBasedOnLocation = basePrice * locationPriceMultiplier

        // --- Scarcity Multiplier (logic remains unchanged) ---
        var scarcityMultiplier = 1.0
        if maxSupply > 0 { // Avoid division by zero
            let percentageSold = UFix64(totalPixelsSold) / UFix64(maxSupply)
            // Scarcity multiplier goes from 1.0 (0% sold) up to scarcityPremiumFactor (100% sold)
            scarcityMultiplier = 1.0 + (scarcityPremiumFactor - 1.0) * percentageSold
        }

        let finalPrice = priceBasedOnLocation * scarcityMultiplier
        return finalPrice
    }

    // The init function is required for a contract, even if it does nothing.
    init() {
        // This library contract has no state to initialize.
    }
} 