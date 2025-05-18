ALTER TABLE "pixels" ADD COLUMN "ipfs_image_cid" text;--> statement-breakpoint
ALTER TABLE "pixels" ADD COLUMN "image_media_type" text;--> statement-breakpoint
ALTER TABLE "pixels" DROP COLUMN "image_url";