// cadence/scripts/CalculatePixelPrice.cdc
// This script calculates the price of a pixel based on provided parameters,
// mirroring the logic from FlowGenPixel.getCurrentPixelPrice.
import "PixelPriceCalculator"

access(all) fun main(
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
  log("x: ".concat(x.toString()))
  return PixelPriceCalculator.calculatePrice(
    x: x,
    y: y,
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight,
    basePrice: basePrice,
    maxSupply: maxSupply,
    totalPixelsSold: totalPixelsSold,
    centerMaxPriceTargetMultiplier: centerMaxPriceTargetMultiplier,
    scarcityPremiumFactor: scarcityPremiumFactor
  )
} 