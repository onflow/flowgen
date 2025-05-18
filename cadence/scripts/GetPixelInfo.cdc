import "FlowGenPixel" // Needed if we want to provide more direct NFT info later

// Returns information about a specific pixel on the canvas
access(all) fun main(x: UInt16, y: UInt16): {String: AnyStruct} {
  let canvasWidth: UInt16 = FlowGenPixel.CANVAS_WIDTH
  let canvasHeight: UInt16 = FlowGenPixel.CANVAS_HEIGHT

  if x >= canvasWidth || y >= canvasHeight {
    return {
      "x": x,
      "y": y,
      "isValidCoordinate": false,
      "error": "Coordinates out of bounds"
    }
  }

  let isTaken: Bool = FlowGenPixel.isPixelMinted(x: x, y: y)
  let nftID: UInt64? = FlowGenPixel.getPixelNFTID(x: x, y: y)

  var result: {String: AnyStruct} = {
    "x": x,
    "y": y,
    "isValidCoordinate": true,
    "isTaken": isTaken,
    "nftID": nftID // This is UInt64?
  }

  if !isTaken {
    result["currentPriceForNewPixel"] = FlowGenPixel.getCurrentPixelPrice(x: x, y: y)
  } else if nftID != nil {
    // If taken and we have an ID, we could potentially add more info
    // by trying to borrow the NFT if we knew its owner.
    // This is complex for a single script without owner info.
    // For now, just providing the ID is sufficient from FlowGenCanvas.
    // A different script could take nftID and owner address for full details.
  }

  return result
}