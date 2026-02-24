import { getPricePerGram } from './metalService.js';

const METAL_MAX_PURITY = {
  XAU: 24,
  XAG: 999,
  XPT: 999,
};

async function fetchTaggedProducts(client, cursor = null) {
  const query = `
    query GetTaggedProducts($cursor: String) {
      products(first: 250, after: $cursor, query: "tag:auto_price_update") {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  price
                  metafields(namespace: "custom", first: 10) {
                    edges {
                      node {
                        key
                        value
                        type
                      }
                    }
                  }
                }
              }
            }
            metafields(namespace: "custom", first: 10) {
              edges {
                node {
                  key
                  value
                  type
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

function parseMetafields(metafieldEdges) {
  const metafields = {};

  if (!metafieldEdges || !Array.isArray(metafieldEdges.edges)) {
    return metafields;
  }

  metafieldEdges.edges.forEach((edge) => {
    if (!edge || !edge.node) {
      return;
    }

    const { key, value, type } = edge.node;

    if (key === null || key === undefined) {
      console.warn('Metafield entry missing key');
      return;
    }

    if (value === null || value === undefined) {
      console.warn(`Metafield "${key}" has null or undefined value`);
      return;
    }

    if (type === 'number_decimal' || type === 'number') {
      const numValue = parseFloat(value);
      if (Number.isNaN(numValue)) {
        console.warn(`Metafield "${key}" cannot be parsed as a number: "${value}"`);
        return;
      }
      metafields[key] = numValue;
    } else {
      metafields[key] = String(value);
    }
  });

  return metafields;
}

function calculateVariantPrice(
  metalCode,
  metalPurity,
  metalWeight,
  makingCharge,
  pricePerGram,
  globalMarkup,
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

async function prepareBulkMutations(products, metalPrices, globalMarkup) {
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

    const productMetafields = parseMetafields(product.metafields);
    const metalType = productMetafields.metal_type;
    const metalPurity = productMetafields.metal_purity;
    const metalWeight = productMetafields.weight_grams;
    const makingCharge = productMetafields.making_charge ?? 0;

    for (const variantEdge of product.variants.edges) {
      if (!variantEdge || !variantEdge.node || !variantEdge.node.id) {
        console.warn(`[SKIP] Product ${product.id}: malformed variant edge`);
        continue;
      }

      const variantNode = variantEdge.node;
      const variantMetafields = parseMetafields(variantNode.metafields);

      // Hierarchy: Use variant-specific value if available, otherwise fall back to product-level
      const finalMetalType = variantMetafields.metal_type || metalType;
      const finalMetalPurity = variantMetafields.metal_purity ?? metalPurity;
      const finalMetalWeight = variantMetafields.weight_grams ?? metalWeight;
      const finalMakingCharge = variantMetafields.making_charge ?? makingCharge;

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
    mutation BulkUpdateVariants($input: [ProductVariantInput!]!) {
      productVariantsBulkUpdate(variants: $input) {
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

    // Shopify limits bulk updates to 250 records per call, but 100 is safer for performance
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < mutations.length; i += CHUNK_SIZE) {
      chunks.push(mutations.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[INFO] Processing ${chunks.length} batch(es) for ${mutations.length} variant(s)...`);

    for (let j = 0; j < chunks.length; j += 1) {
      const chunk = chunks[j];
      console.log(`[INFO] Updating batch ${j + 1}/${chunks.length} (${chunk.length} items)...`);

      const response = await client.graphql(query, {
        variables: { input: chunk },
      });

      if (!response || !response.body || !response.body.data) {
        console.error(`[ERROR] Malformed GraphQL response in batch ${j + 1}`);
        return false;
      }

      const { productVariantsBulkUpdate } = response.body.data;
      if (!productVariantsBulkUpdate) {
        console.error(`[ERROR] Bulk update data missing in batch ${j + 1}`);
        continue; // Try next batch instead of failing entirely
      }

      const { userErrors } = productVariantsBulkUpdate;
      if (Array.isArray(userErrors) && userErrors.length > 0) {
        console.error(`[ERROR] Batch ${j + 1} had ${userErrors.length} error(s)`);
        userErrors.forEach((err) => console.error(`  - ${err.field}: ${err.message}`));
        // We continue to next batch even if this one had errors
      }
    }

    console.log(`[INFO] Completed processing all ${chunks.length} batch(es)`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Exception in bulkUpdateVariants: ${error.message}`);
    return false;
  }
}

async function updatePricesForShop(client, globalMarkup, currency = 'USD', goldApiKey = null, isDryRun = false) {
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

    const metalPrices = {};

    for (const metalCode of ['XAU', 'XAG', 'XPT']) {
      const pricePerGram = await getPricePerGram(metalCode, currency, goldApiKey);
      if (pricePerGram !== null && typeof pricePerGram === 'number') {
        metalPrices[metalCode] = pricePerGram;
      }
    }

    if (Object.keys(metalPrices).length === 0) {
      console.error(`[ERROR] Failed to fetch any metal prices for currency ${currency}`);
      return { success: false, itemsUpdated: 0 };
    }

    console.log(
      `[INFO] Successfully fetched prices for metals in ${currency}: ${Object.keys(metalPrices).join(', ')}`,
    );

    let allProducts = [];
    let cursor = null;
    let hasNextPage = true;
    let pageCount = 0;

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

    const mutations = await prepareBulkMutations(allProducts, metalPrices, globalMarkup);
    console.log(`[INFO] Prepared ${mutations.length} mutations for bulk update`);

    const success = await bulkUpdateVariants(client, mutations, isDryRun);

    return { success, itemsUpdated: mutations.length };
  } catch (error) {
    console.error(`[ERROR] Exception in updatePricesForShop: ${error.message}`);
    return { success: false, itemsUpdated: 0 };
  }
}

export {
  updatePricesForShop,
};
