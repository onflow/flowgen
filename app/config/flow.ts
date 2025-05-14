import { config } from "@onflow/fcl";

config({
  "app.detail.title": "Flowgen App",
  "app.detail.icon": "https://placekitten.com/g/200/200",
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet.method": "EXT/RPC",
  "discovery.wallet":
    "chrome-extension://hpclkefagolihohboafpheddmmgdffjm/popup.html",
  "flow.network": "testnet",
  "0xFungibleToken": "0x9a0766d93b6608b7",
  "0xFlowToken": "0x7e60df042a9c0868",
  "0xNonFungibleToken": "0x631e88ae7f1d7c20",
});
