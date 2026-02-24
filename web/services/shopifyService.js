const METAFIELD_DEFINITIONS = [
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
  }
];

async function ensureMetafieldDefinitions(client) {
  const query = `
    query GetMetafieldDefinitions {
      metafieldDefinitions(first: 250, ownerType: PRODUCT) {
        edges {
          node {
            key
            namespace
          }
        }
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
    const existingDefinitions = response.body.data.metafieldDefinitions.edges.map(e => e.node);

    for (const def of METAFIELD_DEFINITIONS) {
      const exists = existingDefinitions.find(ed => ed.key === def.key && ed.namespace === def.namespace);

      if (!exists) {
        console.log(`Creating metafield definition: ${def.namespace}.${def.key}`);
        const createResponse = await client.graphql(mutation, {
          variables: { definition: def }
        });

        const errors = createResponse.body.data.metafieldDefinitionCreate.userErrors;
        if (errors && errors.length > 0) {
          console.error(`Failed to create metafield definition ${def.key}:`, errors);
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
    return "USD";
  }
}

export {
  ensureMetafieldDefinitions,
  getShopCurrency
};
