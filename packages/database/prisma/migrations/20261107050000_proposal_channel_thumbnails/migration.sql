BEGIN;

-- Public image snapshot reviewed with the proposal; catalog edits never rewrite published versions.
ALTER TABLE "ProposalItem" ADD COLUMN "channelThumbnailUrl" TEXT;

COMMIT;
