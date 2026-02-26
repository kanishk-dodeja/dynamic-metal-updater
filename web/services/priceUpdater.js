import { getAllPricesPerGram } from './metalService.js';
import { calculatePriceFromFormula } from './formulaEngine.js';

const METAL_MAX_PURITY = {
  XAU: 24,
  XAG: 999,
  XPT: 999,
  XPD: 999,
};

async function fetchTaggedProducts(client, cursor = null) {
  const query = `
    query GetTaggedProducts($cursor: String) {
      products(first: 50, after: $cursor, query: "tag:auto_price_update") {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            metal_type: metafield(namespace: "custom", key: "metal_type") { value }
            metal_purity: metafield(namespace: "custom", key: "metal_purity") { value }
            weight_grams: metafield(namespace: "custom", key: "weight_grams") { value }
            making_charge: metafield(namespace: "custom", key: "making_charge") { value }
            variants(first: 100) {
              edges {
                node {
                  id
                  price
                  metal_type: metafield(namespace: "custom", key: "metal_type") { value }
                  metal_purity: metafield(namespace: "custom", key: "metal_purity") { value }
                  weight_grams: metafield(namespace: "custom", key: "weight_grams") { value }
                  making_charge: metafield(namespace: "custom", key: "making_charge") { value }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    if (!client || typeof client.graphql !== 'function') {
      console.error('Invalid GraphQL client provided');
      return null;
    }

    const response = await client.graphql(query, { variables: { cursor } });

    if (!response || !response.body || !response.body.data || !response.body.data.products) {
      console.error('Malformed GraphQL response when fetching tagged products');
      return null;
    }

    return response.body.data.products;
  } catch (error) {
    console.error('Error fetching tagged products:', error.message);
    return null;
  }
}

function extractNumber(metafield) {
  if (!metafield || metafield.value === null || metafield.value === undefined) return null;
  const num = parseFloat(metafield.value);
  return Number.isNaN(num) ? null : num;
}

function extractString(metafield) {
  if (!metafield || metafield.value === null || metafield.value === undefined) return null;
  return String(metafield.value).trim();
}

function calculateVariantPrice(
  metalCode,
  metalPurity,
  metalWeight,
  makingCharge,
  pricePerGram,
  globalMarkup,
  formulaConfig = null,
) {
  if (!metalCode || typeof metalCode !== 'string') {
    console.error('Invalid metalCode provided to calculateVariantPrice');
    return null;
  }

  if (
    metalPurity === null ||
    metalPurity === undefined ||
    typeof metalPurity !== 'number' ||
    metalPurity <= 0
  ) {
    console.error(`Invalid metalPurity: ${metalPurity} (must be positive number)`);
    return null;
  }

  if (
    metalWeight === null ||
    metalWeight === undefined ||
    typeof metalWeight !== 'number' ||
    metalWeight <= 0
  ) {
    console.error(`Invalid metalWeight: ${metalWeight} (must be positive number)`);
    return null;
  }

  if (
    makingCharge === null ||
    makingCharge === undefined ||
    typeof makingCharge !== 'number'
  ) {
    console.error(`Invalid makingCharge: ${makingCharge} (must be a number)`);
    return null;
  }

  if (
    pricePerGram === null ||
    pricePerGram === undefined ||
    typeof pricePerGram !== 'number' ||
    pricePerGram <= 0
  ) {
    console.error(`Invalid pricePerGram: ${pricePerGram} (must be positive number)`);
    return null;
  }

  if (
    globalMarkup === null ||
    globalMarkup === undefined ||
    typeof globalMarkup !== 'number'
  ) {
    console.error(`Invalid globalMarkup: ${globalMarkup} (must be a number)`);
    return null;
  }

  if (formulaConfig) {
    const maxPurity = METAL_MAX_PURITY[metalCode] || 24;
    const result = calculatePriceFromFormula(formulaConfig, {
      pricePerGram,
      purity: metalPurity,
      maxPurity,
      weight: metalWeight,
      makingCharge,
      globalMarkup,
      metafields: { making_charge: makingCharge },
    });
    if (!result || result.finalPrice === null) return null;
    return Number(result.finalPrice.toFixed(2));
  }

  // Fallback to legacy hardcoded calculation
  const maxPurity = METAL_MAX_PURITY[metalCode] || 24;
  const basePrice = pricePerGram * (metalPurity / maxPurity) * metalWeight;
  const finalPrice = (basePrice + makingCharge) * (1 + globalMarkup / 100);

  if (!Number.isFinite(finalPrice) || finalPrice < 0) {
    console.error(
      `Calculation resulted in invalid price: ${finalPrice} (metalCode: ${metalCode}, purity: ${metalPurity}, weight: ${metalWeight}, making: ${makingCharge}, pricePerGram: ${pricePerGram}, markup: ${globalMarkup}%)`,
    );
    return null;
  }

  const roundedPrice = Number(finalPrice.toFixed(2));

  return roundedPrice;
}

async function prepareBulkMutations(products, metalPrices, globalMarkup, formulaConfig = null) {
  const mutations = [];
  const skippedProducts = [];

  if (!Array.isArray(products)) {
    console.error('prepareBulkMutations: products is not an array');
    return mutations;
  }

  if (!metalPrices || typeof metalPrices !== 'object') {
    console.error('prepareBulkMutations: metalPrices is invalid');
    return mutations;
  }

  if (globalMarkup === null || globalMarkup === undefined || typeof globalMarkup !== 'number') {
    console.error('prepareBulkMutations: globalMarkup is invalid');
    return mutations;
  }

  for (const product of products) {
    if (!product || typeof product !== 'object') {
      console.warn('Skipping invalid product object');
      continue;
    }

    if (!product.id) {
      console.warn('Skipping product with no ID');
      continue;
    }

    const metalType = extractString(product.metal_type);
    const metalPurity = extractNumber(product.metal_purity);
    const metalWeight = extractNumber(product.weight_grams);
    const makingCharge = extractNumber(product.making_charge) ?? 0;

    for (const variantEdge of product.variants.edges) {
      if (!variantEdge || !variantEdge.node || !variantEdge.node.id) {
        console.warn(`[SKIP] Product ${product.id}: malformed variant edge`);
        continue;
      }

      const variantNode = variantEdge.node;

      const vMetalType = extractString(variantNode.metal_type);
      const vMetalPurity = extractNumber(variantNode.metal_purity);
      const vMetalWeight = extractNumber(variantNode.weight_grams);
      const vMakingCharge = extractNumber(variantNode.making_charge);

      // Hierarchy: Use variant-specific value if available, otherwise fall back to product-level
      const finalMetalType = vMetalType || metalType;
      const finalMetalPurity = vMetalPurity ?? metalPurity;
      const finalMetalWeight = vMetalWeight ?? metalWeight;
      const finalMakingCharge = vMakingCharge ?? makingCharge;

      if (!finalMetalType) {
        console.warn(`[SKIP] Variant ${variantNode.id}: missing metal_type`);
        continue;
      }

      const pricePerGram = metalPrices[finalMetalType];
      if (pricePerGram === null || pricePerGram === undefined || typeof pricePerGram !== 'number') {
        console.warn(`[SKIP] Variant ${variantNode.id}: no price data for ${finalMetalType}`);
        continue;
      }

      const newPrice = calculateVariantPrice(
        finalMetalType,
        finalMetalPurity,
        finalMetalWeight,
        finalMakingCharge,
        pricePerGram,
        globalMarkup,
        formulaConfig,
      );

      if (newPrice === null) {
        console.warn(
          `[SKIP] Product ${product.id} Variant ${variantEdge.node.id}: price calculation failed`,
        );
        continue;
      }

      mutations.push({
        id: variantEdge.node.id,
        price: newPrice.toString(),
        productId: product.id,
      });
    }
  }

  if (skippedProducts.length > 0) {
    console.log(
      `[INFO] Skipped ${skippedProducts.length} products due to invalid metafields`,
    );
  }

  return mutations;
}

async function bulkUpdateVariants(client, mutations, isDryRun = false) {
  if (!Array.isArray(mutations)) {
    console.error('bulkUpdateVariants: mutations is not an array');
    return false;
  }

  if (mutations.length === 0) {
    console.log('[INFO] No variants to update');
    return true;
  }

  if (isDryRun) {
    console.log(`[DRY-RUN] Would update ${mutations.length} variants:`);
    console.table(mutations);
    return true;
  }

  const query = `
    mutation BulkUpdateVariants($productId: ID!, $input: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $input) {
        productVariants {
          id
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    if (!client || typeof client.graphql !== 'function') {
      console.error('Invalid GraphQL client provided to bulkUpdateVariants');
      return false;
    }

    // Group mutations by productId (required by Shopify API)
    const groupedByProduct = {};
    for (const m of mutations) {
      const pid = m.productId;
      if (!groupedByProduct[pid]) groupedByProduct[pid] = [];
      groupedByProduct[pid].push({ id: m.id, price: m.price });
    }

    const productIds = Object.keys(groupedByProduct);
    console.log(`[INFO] Processing ${mutations.length} variant(s) across ${productIds.length} product(s)...`);

    for (const productId of productIds) {
      const variants = groupedByProduct[productId];
      console.log(`[INFO] Updating product ${productId} (${variants.length} variant(s))...`);

      const response = await client.graphql(query, {
        variables: { productId, input: variants },
      });

      if (!response || !response.body || !response.body.data) {
        console.error(`[ERROR] Malformed GraphQL response for product ${productId}`);
        continue;
      }

      const { productVariantsBulkUpdate } = response.body.data;
      if (!productVariantsBulkUpdate) {
        console.error(`[ERROR] Bulk update data missing for product ${productId}`);
        continue;
      }

      const { userErrors } = productVariantsBulkUpdate;
      if (Array.isArray(userErrors) && userErrors.length > 0) {
        console.error(`[ERROR] Product ${productId} had ${userErrors.length} error(s)`);
        userErrors.forEach((err) => console.error(`  - ${err.field}: ${err.message}`));
      }
    }

    console.log(`[INFO] Completed processing all ${productIds.length} product(s)`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Exception in bulkUpdateVariants: ${error.message}`);
    return false;
  }
}

async function updatePricesForShop(client, globalMarkup, currency = 'USD', goldApiKey = null, isDryRun = false, stopLossConfig = {}, formulaConfig = null, showPriceBreakup = false) {
  try {
    if (!client || typeof client.graphql !== 'function') {
      console.error('Invalid GraphQL client provided to updatePricesForShop');
      return { success: false, itemsUpdated: 0 };
    }

    if (
      globalMarkup === null ||
      globalMarkup === undefined ||
      typeof globalMarkup !== 'number'
    ) {
      console.error(
        `Invalid globalMarkup provided: ${globalMarkup} (must be a number)`,
      );
      return { success: false, itemsUpdated: 0 };
    }

    let allProducts = [];
    let cursor = null;
    let hasNextPage = true;
    let pageCount = 0;

    // 1. Fetch all products first to see what metals we actually need to price
    while (hasNextPage) {
      pageCount += 1;
      const pageData = await fetchTaggedProducts(client, cursor);

      if (!pageData) {
        console.error('[ERROR] Failed to fetch tagged products');
        return { success: false, itemsUpdated: 0 };
      }

      if (!pageData.edges || !Array.isArray(pageData.edges)) {
        console.error('[ERROR] Malformed pageData response');
        return { success: false, itemsUpdated: 0 };
      }

      allProducts = allProducts.concat(pageData.edges.map((e) => e.node));
      hasNextPage = pageData.pageInfo && pageData.pageInfo.hasNextPage === true;
      cursor = pageData.pageInfo && pageData.pageInfo.endCursor;
    }

    console.log(
      `[INFO] Fetched ${allProducts.length} products with auto_price_update tag across ${pageCount} page(s)`,
    );

    if (allProducts.length === 0) {
      console.log('[INFO] No tagged products found, skipping API pull.');
      return { success: true, itemsUpdated: 0 };
    }

    // 2. Identify required metals
    const requiredMetals = new Set();
    allProducts.forEach((product) => {
      const fallbackMetal = product.metal_type && product.metal_type.value
        ? String(product.metal_type.value).trim()
        : null;

      product.variants.edges.forEach((vEdge) => {
        if (!vEdge || !vEdge.node) return;
        const vMetal = vEdge.node.metal_type && vEdge.node.metal_type.value
          ? String(vEdge.node.metal_type.value).trim()
          : fallbackMetal;
        if (vMetal) {
          requiredMetals.add(vMetal.toUpperCase());
        }
      });
    });

    if (requiredMetals.size === 0) {
      console.warn('[INFO] Products are tagged but missing metal_type definitions, skipping API pull.');
      return { success: false, itemsUpdated: 0 };
    }

    // 3. Batch fetch all metal prices in one call
    const allPrices = await getAllPricesPerGram(currency, goldApiKey);
    if (!allPrices) {
      console.error(`[ERROR] Failed to fetch metal prices for currency ${currency}`);
      return { success: false, itemsUpdated: 0 };
    }

    const metalPrices = {};
    for (const metalCode of requiredMetals) {
      if (allPrices[metalCode] !== null && allPrices[metalCode] !== undefined) {
        metalPrices[metalCode] = allPrices[metalCode];
      }
    }

    if (Object.keys(metalPrices).length === 0) {
      console.error(`[ERROR] No valid price data found for required metals: ${Array.from(requiredMetals).join(', ')}`);
      return { success: false, itemsUpdated: 0 };
    }

    // 4. Apply stop-loss logic: if live price is below minimum, use the minimum
    for (const [metalCode, livePrice] of Object.entries(metalPrices)) {
      const minPrice = stopLossConfig[metalCode];
      if (minPrice && typeof minPrice === 'number' && minPrice > 0 && livePrice < minPrice) {
        console.log(`[STOP-LOSS] ${metalCode}: Live price $${livePrice.toFixed(4)}/g is below minimum $${minPrice.toFixed(4)}/g. Using minimum.`);
        metalPrices[metalCode] = minPrice;
      }
    }

    console.log(
      `[INFO] Using prices for metals in ${currency}: ${Object.entries(metalPrices).map(([k, v]) => `${k}=$${v.toFixed(2)}`).join(', ')}`,
    );

    // 5. Prepare and execute mutations
    const mutations = await prepareBulkMutations(allProducts, metalPrices, globalMarkup, formulaConfig);
    console.log(`[INFO] Prepared ${mutations.length} mutations for bulk update`);

    const success = await bulkUpdateVariants(client, mutations, isDryRun);

    // 6. Handle Price Breakdown Metafields (Product-level)
    if (success && !isDryRun && showPriceBreakup) {
      const productMetafields = [];
      for (const product of allProducts) {
        const metalType = extractString(product.metal_type);
        const metalPurity = extractNumber(product.metal_purity);
        const metalWeight = extractNumber(product.weight_grams);
        const makingCharge = extractNumber(product.making_charge) ?? 0;

        if (metalType && metalPurity && metalWeight) {
          const pricePerGram = metalPrices[metalType];
          if (pricePerGram) {
            const calcResult = calculateVariantPrice(
              metalType,
              metalPurity,
              metalWeight,
              makingCharge,
              pricePerGram,
              globalMarkup,
              formulaConfig
            );

            // Re-calculate to get the breakdown object if we have a calcResult
            if (calcResult !== null && formulaConfig) {
              const fullResult = calculatePriceFromFormula(formulaConfig, {
                pricePerGram,
                purity: metalPurity,
                maxPurity: METAL_MAX_PURITY[metalType] || 24,
                weight: metalWeight,
                makingCharge,
                globalMarkup,
                metafields: { making_charge: makingCharge }
              });

              if (fullResult && fullResult.breakdown) {
                productMetafields.push({
                  ownerId: product.id,
                  namespace: "metalsync",
                  key: "price_breakdown",
                  type: "json",
                  value: JSON.stringify(fullResult.breakdown)
                });
              }
            }
          }
        }
      }

      if (productMetafields.length > 0) {
        try {
          console.log(`[INFO] Writing price_breakdown metafields for ${productMetafields.length} products`);
          const metafieldsMutation = `
            mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                userErrors { field message }
              }
            }
          `;

          // Chunk metafield writes (Shopify allows 25 per call)
          const MF_CHUNK = 25;
          for (let i = 0; i < productMetafields.length; i += MF_CHUNK) {
            const chunk = productMetafields.slice(i, i + MF_CHUNK);
            await client.graphql(metafieldsMutation, { variables: { metafields: chunk } });
          }
        } catch (mfError) {
          console.warn('[WARNING] Failed to write product price_breakdown metafields:', mfError.message);
          // Non-fatal, continue with success status
        }
      }
    }

    return {
      success,
      itemsUpdated: mutations.length,
      metalPricesUsed: metalPrices,
      stopLossTriggered: Object.keys(metalPrices).filter(m => stopLossConfig[m] && metalPrices[m] === stopLossConfig[m])
    };
  } catch (error) {
    console.error(`[ERROR] Exception in updatePricesForShop: ${error.message}`);
    return { success: false, itemsUpdated: 0 };
  }
}

export {
  updatePricesForShop,
};
