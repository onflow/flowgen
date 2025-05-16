#!/bin/bash

# Get the NFT details for a specific pixel
# Usage: ./getNftDetails.sh 

# Check if the correct number of arguments are provided

if [ $# -eq 1 ]; then
  account_address=$1
else
  account_address="f8d6e0586b0a20c7"
fi

flow scripts execute /Users/tom/code/flowgen/cadence/scripts/GetUserPixelNFTs.cdc $account_address --network emulator