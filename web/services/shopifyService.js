const METAFIELD_DEFINITIONS = [
  // Product-level definitions
  {
    name: "Metal Type",
    namespace: "custom",
    key: "metal_type",
    description: "Type of metal (XAU, XAG, XPT)",
    type: "single_line_text_field",
    ownerType: "PRODUCT"
  },
  {
    name: "Metal Purity",
    namespace: "custom",
    key: "metal_purity",
    description: "Purity of the metal (e.g. 24 for gold, 999 for silver)",
    type: "number_decimal",
    ownerType: "PRODUCT"
  },
  {
    name: "Weight Grams",
    namespace: "custom",
    key: "weight_grams",
    description: "Weight of the metal in grams",
    type: "number_decimal",
    ownerType: "PRODUCT"
  },
  {
    name: "Making Charge",
    namespace: "custom",
    key: "making_charge",
    description: "Fixed making charge for this item",
    type: "number_decimal",
    ownerType: "PRODUCT"
  },
  // Variant-level definitions (for hierarchy fallback)
  {
    name: "Variant Metal Type",
    namespace: "custom",
    key: "metal_type",
    description: "Variant specific metal override",
    type: "single_line_text_field",
    ownerType: "PRODUCTVARIANT"
  },
  {
    name: "Variant Metal Purity",
    namespace: "custom",
    key: "metal_purity",
    description: "Variant specific purity override",
    type: "number_decimal",
    ownerType: "PRODUCTVARIANT"
  },
  {
    name: "Variant Weight Grams",
    namespace: "custom",
    key: "weight_grams",
    description: "Variant specific weight override",
    type: "number_decimal",
    ownerType: "PRODUCTVARIANT"
  },
  {
    name: "Variant Making Charge",
    namespace: "custom",
    key: "making_charge",
    description: "Variant specific making charge override",
    type: "number_decimal",
    ownerType: "PRODUCTVARIANT"
  }
];

async function ensureMetafieldDefinitions(client) {
  const query = `
    query GetMetafieldDefinitions {
      productDefs: metafieldDefinitions(first: 250, ownerType: PRODUCT) {
        edges { node { key namespace ownerType } }
      }
      variantDefs: metafieldDefinitions(first: 250, ownerType: PRODUCTVARIANT) {
        edges { node { key namespace ownerType } }
      }
    }
  `;

  const mutation = `
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          name
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await client.graphql(query);
    const existingProductDefs = response.body.data.productDefs.edges.map(e => e.node);
    const existingVariantDefs = response.body.data.variantDefs.edges.map(e => e.node);
    const existingDefinitions = [...existingProductDefs, ...existingVariantDefs];

    for (const def of METAFIELD_DEFINITIONS) {
      const exists = existingDefinitions.find(ed =>
        ed.key === def.key &&
        ed.namespace === def.namespace &&
        ed.ownerType === def.ownerType
      );

      if (!exists) {
        console.log(`Creating metafield definition: ${def.namespace}.${def.key} (${def.ownerType})`);
        const createResponse = await client.graphql(mutation, {
          variables: { definition: def }
        });

        const errors = createResponse.body.data.metafieldDefinitionCreate.userErrors;
        if (errors && errors.length > 0) {
          console.error(`Failed to create metafield definition ${def.key} (${def.ownerType}):`, errors);
        }
      }
    }
  } catch (error) {
    console.error("Error ensuring metafield definitions:", error.message);
  }
}

async function getShopCurrency(client) {
  const query = `
    query GetShopCurrency {
      shop {
        currencyCode
      }
    }
  `;

  try {
    const response = await client.graphql(query);
    return response.body.data.shop.currencyCode;
  } catch (error) {
    console.error("Error fetching shop currency:", error.message);
    return null;
  }
}

export {
  ensureMetafieldDefinitions,
  getShopCurrency
};
