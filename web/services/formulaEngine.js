/**
 * Formula Engine for Jewelry Price Calculation
 * 
 * This module allows flexible, step-by-step price calculations based on metal market prices,
 * product metadata, and merchant-defined logic.
 */

const DEFAULT_FORMULA_CONFIG = [
    {
        id: "metal_cost", type: "computed", label: "Metal Cost",
        computation: "pricePerGram * (purity / maxPurity) * weight"
    },
    {
        id: "making_charge", type: "fixed", label: "Making Charge",
        source: "metafield", metafieldKey: "making_charge", defaultValue: 0, unit: "currency"
    },
    {
        id: "wastage", type: "percentage", label: "Wastage",
        applyOn: "metal_cost", defaultValue: 0, unit: "percentage"
    },
    {
        id: "stone_charge", type: "fixed", label: "Stone/Diamond Charge",
        source: "metafield", metafieldKey: "stone_charge", defaultValue: 0, unit: "currency"
    },
    {
        id: "subtotal", type: "sum", label: "Subtotal",
        components: ["metal_cost", "making_charge", "wastage", "stone_charge"]
    },
    {
        id: "tax", type: "percentage", label: "Tax/GST",
        applyOn: "subtotal", defaultValue: 0, unit: "percentage"
    },
    {
        id: "markup", type: "percentage", label: "Markup",
        applyOn: "subtotal", defaultValue: 0, unit: "percentage", source: "global"
    },
    {
        id: "final_price", type: "sum", label: "Final Price",
        components: ["subtotal", "tax", "markup"]
    }
];

/**
 * Calculates the final price and breakdown based on a formula configuration and inputs.
 * 
 * @param {Array} formulaConfig - Array of step definitions
 * @param {Object} inputs - { pricePerGram, purity, maxPurity, weight, makingCharge, globalMarkup, metafields: {} }
 * @returns {Object|null} - { finalPrice, breakdown } or null if invalid
 */
export function calculatePriceFromFormula(formulaConfig, inputs) {
    const values = {};
    const breakdown = {};

    try {
        for (const step of formulaConfig) {
            let stepValue = 0;

            switch (step.type) {
                case "computed":
                    if (step.id === "metal_cost") {
                        const { pricePerGram, purity, maxPurity, weight } = inputs;
                        if (maxPurity <= 0) {
                            console.warn("[FormulaEngine] Division by zero in maxPurity");
                            stepValue = 0;
                        } else {
                            stepValue = pricePerGram * (purity / maxPurity) * weight;
                        }
                    }
                    break;

                case "fixed":
                    if (step.source === "metafield") {
                        const val = inputs.metafields ? inputs.metafields[step.metafieldKey] : undefined;
                        stepValue = (val !== null && val !== undefined) ? parseFloat(val) : step.defaultValue;
                    } else {
                        stepValue = step.defaultValue;
                    }
                    break;

                case "percentage":
                    const baseValue = values[step.applyOn] || 0;
                    const percentage = (step.source === "global") ? inputs.globalMarkup : step.defaultValue;
                    stepValue = baseValue * (percentage / 100);
                    break;

                case "sum":
                    stepValue = (step.components || []).reduce((acc, id) => acc + (values[id] || 0), 0);
                    break;

                default:
                    console.warn(`[FormulaEngine] Unknown step type: ${step.type}`);
                    stepValue = 0;
            }

            // Handle math edge cases
            if (isNaN(stepValue) || !isFinite(stepValue)) {
                stepValue = 0;
            }

            values[step.id] = stepValue;
            breakdown[step.id] = {
                label: step.label,
                value: Number(stepValue.toFixed(2))
            };
        }

        const finalPrice = values["final_price"] ?? values[formulaConfig[formulaConfig.length - 1].id];

        if (isNaN(finalPrice) || !isFinite(finalPrice) || finalPrice < 0) {
            return null;
        }

        return {
            finalPrice: Number(finalPrice.toFixed(2)),
            breakdown
        };
    } catch (error) {
        console.error("[FormulaEngine] Calculation error:", error.message);
        return null;
    }
}

/**
 * Returns the default formula configuration.
 */
export function getDefaultFormulaConfig() {
    return [...DEFAULT_FORMULA_CONFIG];
}

/**
 * Validates the formula configuration structure and references.
 */
export function validateFormulaConfig(config) {
    if (!Array.isArray(config)) {
        return { valid: false, errors: ["Config must be an array"] };
    }

    const errors = [];
    const ids = new Set();

    for (const step of config) {
        if (!step.id) errors.push("Step missing id");
        if (ids.has(step.id)) errors.push(`Duplicate step id: ${step.id}`);
        ids.add(step.id);

        if (step.type === "percentage" && !ids.has(step.applyOn)) {
            errors.push(`Step ${step.id} references non-existent base: ${step.applyOn}`);
        }

        if (step.type === "sum") {
            for (const compId of (step.components || [])) {
                if (!ids.has(compId)) {
                    errors.push(`Step ${step.id} references non-existent component: ${compId}`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
