#!/bin/bash

# Get the NFT details for a specific pixel
# Usage: ./getNftDetails.sh <account_address> <nft_id>

# Check if the correct number of arguments are provided

if [ $# -eq 2 ]; then
  account_address=$1
  nft_id=$2
else
  account_address="f8d6e0586b0a20c7"
  nft_id=32
  echo "Usage: ./getNftDetails.sh <account_address> <nft_id>"
fi

flow scripts execute /Users/tom/code/flowgen/cadence/scripts/GetPixelNFTDetails.cdc $account_address $nft_id --network emulator