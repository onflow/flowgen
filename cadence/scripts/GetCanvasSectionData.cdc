// cadence/scripts/GetCanvasSectionData.cdc
import FlowGenCanvas from "FlowGenCanvas"

// This struct returns basic, reliably queryable info for each pixel in a section.
access(all) struct BasicPixelInfo {
    access(all) let x: UInt16
    access(all) let y: UInt16
    access(all) let isTaken: Bool
    access(all) let nftId: UInt64?
    // Richer details like ownerId, imageURL, prompt, style, price, isListed, listingId
    // are harder to get reliably for all pixels in a section directly on-chain without owner context
    // or significant contract-level data mapping/indexing.
    // The client will need to fetch these richer details separately if needed, e.g., via an off-chain index
    // or for specific NFTs where context allows (like user-owned NFTs).

    init(x: UInt16, y: UInt16, isTaken: Bool, nftId: UInt64?) {
        self.x = x
        self.y = y
        self.isTaken = isTaken
        self.nftId = nftId
    }
}

access(all) fun main(startX: UInt16, startY: UInt16, width: UInt16, height: UInt16): [BasicPixelInfo] {
    let results: [BasicPixelInfo] = []

    let canvasTotalWidth = FlowGenCanvas.canvasWidth
    let canvasTotalHeight = FlowGenCanvas.canvasHeight

    var loopEndX = startX + width
    if loopEndX > canvasTotalWidth {
        loopEndX = canvasTotalWidth
    }

    var loopEndY = startY + height
    if loopEndY > canvasTotalHeight {
        loopEndY = canvasTotalHeight
    }

    var currentY = startY
    while currentY < loopEndY {
        var currentX = startX
        while currentX < loopEndX {
            let isTaken = FlowGenCanvas.isPixelTaken(x: currentX, y: currentY)
            var currentNftId: UInt64? = nil
            if isTaken {
                currentNftId = FlowGenCanvas.getNFTIDForPixel(x: currentX, y: currentY)
            }

            results.append(
                BasicPixelInfo(
                    x: currentX,
                    y: currentY,
                    isTaken: isTaken,
                    nftId: currentNftId
                )
            )
            currentX = currentX + 1
        }
        currentY = currentY + 1
    }
    return results
} 