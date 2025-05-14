import { config } from "@onflow/fcl";

config()
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("discovery.wallet.method", "EXT/RPC")
  .put(
    "discovery.wallet",
    "chrome-extension://hpclkefagolihohboafpheddmmgdffjm/popup.html"
  )
  .put("flow.network", "testnet");
