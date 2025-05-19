// scripts/GetFlowGenPixelState.cdc
import FlowGenPixel from "FlowGenPixel" // This assumes "FlowGenPixel" is an alias in your flow.json
                                      // or that the contract is deployed with this name on the target network.

access(all) fun main(): {String: AnyStruct} {
    let state: {String: AnyStruct} = {}

    // Access public 'access(all)' fields directly
    state["totalPixelsSold_field"] = FlowGenPixel.totalPixelsSold 
    state["CANVAS_WIDTH"] = FlowGenPixel.CANVAS_WIDTH
    state["CANVAS_HEIGHT"] = FlowGenPixel.CANVAS_HEIGHT
    state["MAX_SUPPLY"] = FlowGenPixel.MAX_SUPPLY
    state["BASE_PRICE"] = FlowGenPixel.BASE_PRICE
    state["MID_TIER_PRICE_MULTIPLIER"] = FlowGenPixel.MID_TIER_PRICE_MULTIPLIER
    state["CENTER_TIER_PRICE_MULTIPLIER"] = FlowGenPixel.CENTER_TIER_PRICE_MULTIPLIER
    state["MID_TIER_THRESHOLD_PERCENT"] = FlowGenPixel.MID_TIER_THRESHOLD_PERCENT
    state["EDGE_TIER_THRESHOLD_PERCENT"] = FlowGenPixel.EDGE_TIER_THRESHOLD_PERCENT
    state["SCARCITY_PREMIUM_FACTOR"] = FlowGenPixel.SCARCITY_PREMIUM_FACTOR
    state["PIXEL_SALE_FEE_RECEIVER_ADDRESS"] = FlowGenPixel.PIXEL_SALE_FEE_RECEIVER_ADDRESS

    // Call public 'access(all) view' functions
    state["totalPixelsSold_func"] = FlowGenPixel.getTotalPixelsSold()
    // Example: To check a specific pixel (uncomment and adjust coordinates if needed)
    // state["is_0_0_minted"] = FlowGenPixel.isPixelMinted(x: 0, y: 0)
    // state["nftID_for_0_0"] = FlowGenPixel.getPixelNFTID(x: 0, y: 0)

    return state
} 