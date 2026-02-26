import Papa from 'papaparse';

/**
 * Parses a CSV string containing product configurations.
 * 
 * @param {string} csvString - The raw CSV content.
 * @returns {Object} { valid: Array, errors: Array }
 */
export function parseProductConfigCSV(csvString) {
    const result = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
    });

    const valid = [];
    const errors = [];

    const requiredMetals = ['XAU', 'XAG', 'XPT', 'XPD'];

    result.data.forEach((row, index) => {
        const rowNum = index + 2; // +1 for header, +1 for 1-based index
        const {
            product_id,
            variant_id,
            metal_type,
            metal_purity,
            weight_grams,
            making_charge
        } = row;

        // 1. Basic Validation
        if (!product_id) {
            errors.push({ row: rowNum, message: "Missing product_id" });
            return;
        }

        if (!metal_type || !requiredMetals.includes(String(metal_type).toUpperCase())) {
            errors.push({ row: rowNum, message: "Missing or invalid metal_type (XAU, XAG, XPT, XPD)" });
            return;
        }

        if (typeof metal_purity !== 'number' || metal_purity <= 0) {
            errors.push({ row: rowNum, message: "metal_purity must be a positive number" });
            return;
        }

        if (typeof weight_grams !== 'number' || weight_grams <= 0) {
            errors.push({ row: rowNum, message: "weight_grams must be a positive number" });
            return;
        }

        const finalMakingCharge = (making_charge !== null && making_charge !== undefined)
            ? parseFloat(making_charge)
            : 0;

        if (isNaN(finalMakingCharge) || finalMakingCharge < 0) {
            errors.push({ row: rowNum, message: "making_charge must be a number >= 0" });
            return;
        }

        // 2. Format IDs to GID format
        const formatGID = (id, type) => {
            if (!id) return null;
            const sId = String(id).trim();
            if (sId.startsWith('gid://')) return sId;
            return `gid://shopify/${type}/${sId}`;
        };

        valid.push({
            shopifyProductId: formatGID(product_id, 'Product'),
            shopifyVariantId: formatGID(variant_id, 'ProductVariant'),
            metalType: String(metal_type).toUpperCase(),
            metalPurity: Number(metal_purity),
            weightGrams: Number(weight_grams),
            makingCharge: finalMakingCharge
        });
    });

    return { valid, errors };
}

/**
 * Generates a CSV string from an array of product configurations.
 * 
 * @param {Array} productConfigs - Array of ProductConfig objects from Prisma.
 * @returns {string} CSV content
 */
export function generateProductConfigCSV(productConfigs) {
    if (!Array.isArray(productConfigs)) return "";

    const data = productConfigs.map(config => ({
        product_id: config.shopifyProductId.replace('gid://shopify/Product/', ''),
        variant_id: config.shopifyVariantId ? config.shopifyVariantId.replace('gid://shopify/ProductVariant/', '') : '',
        metal_type: config.metalType,
        metal_purity: config.metalPurity,
        weight_grams: config.weightGrams,
        making_charge: config.makingCharge
    }));

    return Papa.unparse(data);
}

/**
 * Generates a template CSV string for users to download.
 */
export function generateTemplateCSV() {
    const data = [
        {
            product_id: "123456789",
            variant_id: "",
            metal_type: "XAU",
            metal_purity: 18,
            weight_grams: 10.5,
            making_charge: 50
        },
        {
            product_id: "123456789",
            variant_id: "987654321",
            metal_type: "XAG",
            metal_purity: 999,
            weight_grams: 25,
            making_charge: 0
        }
    ];

    return Papa.unparse(data);
}
