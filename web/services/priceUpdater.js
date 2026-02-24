const { getPricePerGram } = require('./metalService');

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
  const finalPrice =
    pricePerGram * (metalPurity / maxPurity) * metalWeight + makingCharge + globalMarkup;

  if (!Number.isFinite(finalPrice) || finalPrice < 0) {
    console.error(
      `Calculation resulted in invalid price: ${finalPrice} (metalCode: ${metalCode}, purity: ${metalPurity}, weight: ${metalWeight}, making: ${makingCharge}, pricePerGram: ${pricePerGram}, markup: ${globalMarkup})`,
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

    if (!metalType || metalType === '') {
      console.warn(`[SKIP] Product ${product.id}: missing metal_type metafield`);
      skippedProducts.push(product.id);
      continue;
    }

    if (
      metalPurity === null ||
      metalPurity === undefined ||
      typeof metalPurity !== 'number'
    ) {
      console.warn(`[SKIP] Product ${product.id}: invalid or missing metal_purity metafield`);
      skippedProducts.push(product.id);
      continue;
    }

    if (
      metalWeight === null ||
      metalWeight === undefined ||
      typeof metalWeight !== 'number'
    ) {
      console.warn(`[SKIP] Product ${product.id}: invalid or missing weight_grams metafield`);
      skippedProducts.push(product.id);
      continue;
    }

    const pricePerGram = metalPrices[metalType];
    if (pricePerGram === null || pricePerGram === undefined || typeof pricePerGram !== 'number') {
      console.warn(`[SKIP] Product ${product.id}: no price data available for metal ${metalType}`);
      skippedProducts.push(product.id);
      continue;
    }

    if (!product.variants || !Array.isArray(product.variants.edges)) {
      console.warn(`[SKIP] Product ${product.id}: no variants found`);
      skippedProducts.push(product.id);
      continue;
    }

    for (const variantEdge of product.variants.edges) {
      if (!variantEdge || !variantEdge.node || !variantEdge.node.id) {
        console.warn(`[SKIP] Product ${product.id}: malformed variant edge`);
        continue;
      }

      const newPrice = calculateVariantPrice(
        metalType,
        metalPurity,
        metalWeight,
        makingCharge,
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

    const response = await client.graphql(query, {
      variables: { input: mutations },
    });

    if (!response || !response.body || !response.body.data) {
      console.error('Malformed GraphQL response from productVariantsBulkUpdate');
      return false;
    }

    const { productVariantsBulkUpdate } = response.body.data;

    if (!productVariantsBulkUpdate) {
      console.error('productVariantsBulkUpdate did not return expected data');
      return false;
    }

    const { userErrors } = productVariantsBulkUpdate;

    if (Array.isArray(userErrors) && userErrors.length > 0) {
      console.error(
        `[ERROR] Bulk update completed with ${userErrors.length} error(s):`,
      );
      userErrors.forEach((err) => {
        console.error(`  - Field: ${err.field}, Message: ${err.message}`);
      });
      return false;
    }

    console.log(`[SUCCESS] Successfully updated ${mutations.length} variant(s)`);
    return true;
  } catch (error) {
    console.error(
      `[ERROR] Exception in bulkUpdateVariants: ${error.message}`,
    );
    return false;
  }
}

async function updatePricesForShop(client, globalMarkup, isDryRun = false) {
  try {
    if (!client || typeof client.graphql !== 'function') {
      console.error('Invalid GraphQL client provided to updatePricesForShop');
      return false;
    }

    if (
      globalMarkup === null ||
      globalMarkup === undefined ||
      typeof globalMarkup !== 'number'
    ) {
      console.error(
        `Invalid globalMarkup provided: ${globalMarkup} (must be a number)`,
      );
      return false;
    }

    const metalPrices = {};

    for (const metalCode of ['XAU', 'XAG', 'XPT']) {
      const pricePerGram = await getPricePerGram(metalCode);
      if (pricePerGram !== null && typeof pricePerGram === 'number') {
        metalPrices[metalCode] = pricePerGram;
      }
    }

    if (Object.keys(metalPrices).length === 0) {
      console.error('[ERROR] Failed to fetch any metal prices');
      return false;
    }

    console.log(
      `[INFO] Successfully fetched prices for metals: ${Object.keys(metalPrices).join(', ')}`,
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
        return false;
      }

      if (!pageData.edges || !Array.isArray(pageData.edges)) {
        console.error('[ERROR] Malformed pageData response');
        return false;
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

    return success;
  } catch (error) {
    console.error(`[ERROR] Exception in updatePricesForShop: ${error.message}`);
    return false;
  }
}

module.exports = {
  updatePricesForShop,
};
