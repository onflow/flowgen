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
    midTierPriceMultiplier: UFix64,
    centerTierPriceMultiplier: UFix64,
    midTierThresholdPercent: UFix64,
    edgeTierThresholdPercent: UFix64, // Typically if > midTierThreshold, it's edge or center
    maxSupply: UInt64,
    totalPixelsSold: UInt64,
    scarcityPremiumFactor: UFix64
): UFix64 {
  log("x: ".concat(x.toString()))
  return PixelPriceCalculator.calculatePrice(
    x: x,
    y: y,
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight,
    basePrice: basePrice,
    midTierPriceMultiplier: midTierPriceMultiplier,
    centerTierPriceMultiplier: centerTierPriceMultiplier,
    midTierThresholdPercent: midTierThresholdPercent,
    edgeTierThresholdPercent: edgeTierThresholdPercent,
    maxSupply: maxSupply,
    totalPixelsSold: totalPixelsSold,
    scarcityPremiumFactor: scarcityPremiumFactor
  )
} 