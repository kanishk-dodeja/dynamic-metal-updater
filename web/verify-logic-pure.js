const METAL_MAX_PURITY = {
    XAU: 24,
    XAG: 999,
    XPT: 999,
};

function calculateVariantPrice(
    metalCode,
    metalPurity,
    metalWeight,
    makingCharge,
    pricePerGram,
    globalMarkup,
) {
    const maxPurity = METAL_MAX_PURITY[metalCode] || 24;
    const basePrice = pricePerGram * (metalPurity / maxPurity) * metalWeight;
    const finalPrice = (basePrice + makingCharge) * (1 + globalMarkup / 100);

    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
        return null;
    }

    return Number(finalPrice.toFixed(2));
}

function test() {
    console.log("Running Pure Logic Test...");

    // Inputs
    const metalCode = "XAU";
    const metalPurity = 18;
    const metalWeight = 10;
    const makingCharge = 50;
    const pricePerGram = 100;
    const globalMarkup = 10; // 10%

    const result = calculateVariantPrice(metalCode, metalPurity, metalWeight, makingCharge, pricePerGram, globalMarkup);

    console.log(`Inputs: Purity=${metalPurity}, Weight=${metalWeight}, Making=${makingCharge}, Price/g=${pricePerGram}, Markup=${globalMarkup}%`);
    console.log(`Result: ${result}`);

    const expected = 880;
    if (result === expected) {
        console.log("✅ SUCCESS: Logic matches manual calculation (880)");
    } else {
        console.log(`❌ FAILURE: Expected ${expected}, got ${result}`);
    }
}

test();
