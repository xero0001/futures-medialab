BEGIN;

CREATE TABLE "GameCatalog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "thumbnailUrl" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "searchText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameCatalog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GameLocalization" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" TEXT NOT NULL,
  "officialUrl" TEXT,
  CONSTRAINT "GameLocalization_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "GameCatalog" ADD CONSTRAINT "GameCatalog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "GameCatalog_organizationId_idx" ON "GameCatalog"("organizationId");
CREATE UNIQUE INDEX "GameCatalog_key_key" ON "GameCatalog"("key");
CREATE INDEX "GameCatalog_verified_title_idx" ON "GameCatalog"("verified", "title");
CREATE UNIQUE INDEX "GameLocalization_gameId_locale_key" ON "GameLocalization"("gameId", "locale");
CREATE INDEX "GameLocalization_title_idx" ON "GameLocalization"("title");
ALTER TABLE "GameLocalization" ADD CONSTRAINT "GameLocalization_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD COLUMN "gameId" TEXT;
CREATE INDEX "Campaign_gameId_idx" ON "Campaign"("gameId");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Verified against the publisher's Korean, English and mainland Chinese sites.
-- The thumbnail is the unmodified official app icon already included in the platform.
INSERT INTO "GameCatalog" ("id", "key", "title", "thumbnailUrl", "verified", "aliases", "searchText", "updatedAt")
VALUES ('game_nte', 'neverness-to-everness', 'NTE (Neverness to Everness)', '/demo/nte/game-icon.png', true,
  ARRAY['이환', 'nte', 'neverness to everness', 'nte (neverness to everness)', '异环', '異環', '이 환'],
  '이환 이 환 nte neverness to everness nte (neverness to everness) 异环 異環', CURRENT_TIMESTAMP);
INSERT INTO "GameLocalization" ("id", "gameId", "locale", "title", "officialUrl") VALUES
  ('game_nte_ko', 'game_nte', 'KO', '이환', 'https://nte.perfectworld.com/kr/'),
  ('game_nte_en', 'game_nte', 'EN', 'NTE (Neverness to Everness)', 'https://nte.perfectworld.com/en/'),
  ('game_nte_zh', 'game_nte', 'ZH', '异环', 'https://yh.wanmei.com/');

COMMIT;
