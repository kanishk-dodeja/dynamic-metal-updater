-- Migration script for expanding schema with Stop-Loss, Pricing Formulas, and Product Configurations

-- 1. Modify MerchantSettings table
ALTER TABLE "MerchantSettings" 
ADD COLUMN IF NOT EXISTS "stopLossXAU" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "stopLossXAG" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "stopLossXPT" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "stopLossXPD" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "syncFrequencyMin" INTEGER NOT NULL DEFAULT 360,
ADD COLUMN IF NOT EXISTS "showPriceBreakup" BOOLEAN NOT NULL DEFAULT false;

-- 2. Create PricingFormula table
CREATE TABLE IF NOT EXISTS "PricingFormula" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "formulaConfig" TEXT NOT NULL,
    "applyToTags" TEXT NOT NULL DEFAULT 'auto_price_update',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingFormula_pkey" PRIMARY KEY ("id")
);

-- 3. Create ProductConfig table
CREATE TABLE IF NOT EXISTS "ProductConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    "metalType" TEXT NOT NULL,
    "metalPurity" DOUBLE PRECISION NOT NULL,
    "weightGrams" DOUBLE PRECISION NOT NULL,
    "makingCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "formulaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductConfig_pkey" PRIMARY KEY ("id")
);

-- 4. Add indices
CREATE INDEX IF NOT EXISTS "PricingFormula_shop_idx" ON "PricingFormula"("shop");
CREATE INDEX IF NOT EXISTS "ProductConfig_shop_idx" ON "ProductConfig"("shop");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductConfig_shop_shopifyProductId_shopifyVariantId_key" ON "ProductConfig"("shop", "shopifyProductId", "shopifyVariantId");

-- 5. Add Foreign Key constraints
-- Note: Using DO block to check if constraint exists before adding (standard PG practice for migrations)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PricingFormula_shop_fkey') THEN
        ALTER TABLE "PricingFormula" ADD CONSTRAINT "PricingFormula_shop_fkey" FOREIGN KEY ("shop") REFERENCES "MerchantSettings"("shop") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductConfig_shop_fkey') THEN
        ALTER TABLE "ProductConfig" ADD CONSTRAINT "ProductConfig_shop_fkey" FOREIGN KEY ("shop") REFERENCES "MerchantSettings"("shop") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductConfig_formulaId_fkey') THEN
        ALTER TABLE "ProductConfig" ADD CONSTRAINT "ProductConfig_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "PricingFormula"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
