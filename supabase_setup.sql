-- Create Table: Session
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "userId" BIGINT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Create Table: MerchantSettings
CREATE TABLE IF NOT EXISTS "MerchantSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "goldApiKey" TEXT NOT NULL,
    "markupPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storeCurrency" TEXT NOT NULL DEFAULT 'USD',
    "isCronActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantSettings_pkey" PRIMARY KEY ("id")
);

-- Create Table: SyncLog
CREATE TABLE IF NOT EXISTS "SyncLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Session_shop_isOnline_key" ON "Session"("shop", "isOnline");
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSettings_shop_key" ON "MerchantSettings"("shop");
CREATE INDEX IF NOT EXISTS "SyncLog_shop_idx" ON "SyncLog"("shop");

-- Add Foreign Key
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_shop_fkey" FOREIGN KEY ("shop") REFERENCES "MerchantSettings"("shop") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Function to handle automatic updatedAt updates
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for MerchantSettings
CREATE TRIGGER tr_merchant_settings_updated_at
BEFORE UPDATE ON "MerchantSettings"
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
