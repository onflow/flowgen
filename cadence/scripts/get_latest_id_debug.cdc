// get_latest_id_debug.cdc
import "CanvasBackground"

access(all) fun main(): UInt64? {
  log(CanvasBackground.latestBackgroundNftID)
  return CanvasBackground.latestBackgroundNftID
}