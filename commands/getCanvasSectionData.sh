#!/bin/bash

# Get the NFT details for a specific pixel
# Usage: ./getCanvasSectionData.sh 

# Check if the correct number of arguments are provided

if [ $# -eq 4 ]; then
  startX=$1
  startY=$2
  width=$3
  height=$4
else
  startX=0
  startY=0
  width=20
  height=20
fi

flow scripts execute /Users/tom/code/flowgen/cadence/scripts/GetCanvasSectionData.cdc $startX $startY $width $height --network emulator -o json