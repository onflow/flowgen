import { useCallback } from 'react';

interface BackgroundUpdateParams {
  eventType: "PixelMinted" | "PixelImageUpdated";
  transactionId: string;
  pixelId: number;
  x: number;
  y: number;
  ipfsImageCID: string;
  triggeringAiImageID?: number;
}

export function useBackgroundUpdate() {
  const triggerBackgroundUpdate = useCallback(async (params: BackgroundUpdateParams) => {
    try {
      const response = await fetch('/api/background-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger background update: ${await response.text()}`);
      }

      const result = await response.json();
      console.log('Background update triggered:', result);
      return result;
    } catch (error) {
      console.error('Error triggering background update:', error);
      throw error;
    }
  }, []);

  return { triggerBackgroundUpdate };
}

// Hook to listen for pixel events and trigger background updates
export function usePixelEventListener() {
  const { triggerBackgroundUpdate } = useBackgroundUpdate();

  const handlePixelMinted = useCallback(async (event: any) => {
    try {
      await triggerBackgroundUpdate({
        eventType: "PixelMinted",
        transactionId: event.transactionId,
        pixelId: event.data.id,
        x: event.data.x,
        y: event.data.y,
        ipfsImageCID: event.data.ipfsImageCID,
        triggeringAiImageID: event.data.initialAiImageNftID,
      });
    } catch (error) {
      console.error('Failed to handle PixelMinted event:', error);
    }
  }, [triggerBackgroundUpdate]);

  const handlePixelImageUpdated = useCallback(async (event: any) => {
    try {
      await triggerBackgroundUpdate({
        eventType: "PixelImageUpdated",
        transactionId: event.transactionId,
        pixelId: event.data.pixelId,
        x: event.data.x,
        y: event.data.y,
        ipfsImageCID: event.data.ipfsImageCID,
        triggeringAiImageID: event.data.newAiImageNftID,
      });
    } catch (error) {
      console.error('Failed to handle PixelImageUpdated event:', error);
    }
  }, [triggerBackgroundUpdate]);

  return { handlePixelMinted, handlePixelImageUpdated };
}