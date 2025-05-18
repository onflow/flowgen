
{
    "x": 7,
    "y": 9,
    "finalPixelName": "Pixel Art #7-9",
    "finalDescription": "Some prompt",
    "finalAiCadencePrompt": "Some prompt",
    "finalIpfsImageCID": "bafkreieclfozk3zcyk4v35frzyucuem2syj6ag5e4us3kqm2wraqboea2m",
    "mediaType": "image/jpeg",
    "flowPaymentAmount": "1.01562500"
}

flow transactions send cadence/transactions/PurchasePixel.cdc \
  7 \
  9 \
  "Pixel Art #7-9" \
  "Some prompt" \
  "some great ai prompt" \
  bafkreieclfozk3zcyk4v35frzyucuem2syj6ag5e4us3kqm2wraqboea2m \
  "image/jpeg" \
  "4.06250000" \
  --network emulator \
  --signer emulator-account