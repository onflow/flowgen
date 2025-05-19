// cadence/contracts/PixelPriceCalculator.cdc
// This contract acts as a library to provide pixel price calculation logic.

access(all) contract PixelPriceCalculator {

    // Calculates the price of a pixel based on provided parameters.
    // This logic mirrors what was previously in the CalculatePixelPrice.cdc script
    // and FlowGenPixel.getCurrentPixelPrice contract function.
    access(all) view fun calculatePrice(
        x: UInt16,
        y: UInt16,
        canvasWidth: UInt16,
        canvasHeight: UInt16,
        basePrice: UFix64,
        midTierPriceMultiplier: UFix64,
        centerTierPriceMultiplier: UFix64,
        midTierThresholdPercent: UFix64,
        edgeTierThresholdPercent: UFix64,
        maxSupply: UInt64,
        totalPixelsSold: UInt64,
        scarcityPremiumFactor: UFix64
    ): UFix64 {

        // Calculate center coordinates (as UFix64 for precision in division)
        let centerX = UFix64(canvasWidth) / 2.0
        let centerY = UFix64(canvasHeight) / 2.0

        // Calculate Manhattan distance from center
        let xUFix64 = UFix64(x)
        let yUFix64 = UFix64(y)
        
        let absDx = (xUFix64 > centerX) ? (xUFix64 - centerX) : (centerX - xUFix64)
        let absDy = (yUFix64 > centerY) ? (yUFix64 - centerY) : (centerY - yUFix64)
        let manhattanDist = absDx + absDy

        let maxManhattanDist = centerX + centerY

        var locationPriceMultiplier = 1.0 // Default to base multiplier (edge tier)
        if maxManhattanDist > 0.0 { // Avoid division by zero if canvas is 1x1 or 0x0
            let normalizedManhattanDist = manhattanDist / maxManhattanDist
            if normalizedManhattanDist <= midTierThresholdPercent { // Center Tier
                locationPriceMultiplier = centerTierPriceMultiplier
            } else if normalizedManhattanDist <= edgeTierThresholdPercent { // Mid Tier
                locationPriceMultiplier = midTierPriceMultiplier
            } // Else: Edge Tier, multiplier remains 1.0 (implicitly for basePrice)
        }
        
        let priceBasedOnLocation = basePrice * locationPriceMultiplier

        // Calculate Scarcity Multiplier
        var scarcityMultiplier = 1.0
        if maxSupply > 0 { // Avoid division by zero
            let percentageSold = UFix64(totalPixelsSold) / UFix64(maxSupply)
            scarcityMultiplier = 1.0 + ((scarcityPremiumFactor - 1.0) * percentageSold)
        }

        let finalPrice = priceBasedOnLocation * scarcityMultiplier
        return finalPrice
    }

    // The init function is required for a contract, even if it does nothing.
    init() {
        // This library contract has no state to initialize.
    }
} 