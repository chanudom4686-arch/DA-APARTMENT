export type MeterConfig = {
  elecRate: number; // e.g. 8 baht/unit
  waterRate: number; // e.g. 20 baht/unit
  // Keep old fields for fallback compatibility if needed
  elecType?: "meter" | "flat";
  waterType?: "meter_with_min" | "flat";
  waterMinUnits?: number;
  waterMinPrice?: number;
  commonFee?: number;
};

export type InvoiceInput = {
  roomId: string;
  roomPrice: number;
  
  prevElec: number;
  currentElec: number;
  prevElecB?: number;
  currentElecB?: number;
  elecMeterType?: number; // 1 or 2
  
  prevWater: number;
  currentWater: number;
  waterMeterType?: string; // 'min' or 'flat'
  waterMinPrice?: number;
  waterFlatPrice?: number;
  
  commonFee?: number;
  
  config: MeterConfig;
  additionalFees?: { name: string; amount: number }[];
};

export function calculateInvoice(input: InvoiceInput) {
  const { config } = input;
  
  // 1. Electricity Calculation
  const elecUsageA = Math.max(0, input.currentElec - input.prevElec);
  const elecTotalA = elecUsageA * config.elecRate;
  
  let elecUsageB = 0;
  let elecTotalB = 0;
  if (input.elecMeterType === 2 && input.currentElecB !== undefined && input.prevElecB !== undefined) {
    elecUsageB = Math.max(0, input.currentElecB - input.prevElecB);
    elecTotalB = elecUsageB * config.elecRate;
  }
  
  const elecUsage = elecUsageA + elecUsageB;
  const elecTotal = elecTotalA + elecTotalB;

  // 2. Water Calculation
  let waterUsage = 0;
  let waterTotal = 0;

  if (input.waterMeterType === "flat") {
    waterTotal = input.waterFlatPrice || 0;
  } else {
    waterUsage = Math.max(0, input.currentWater - input.prevWater);
    waterTotal = waterUsage * config.waterRate;
    
    // Apply Minimum Price constraint if specified
    if (input.waterMinPrice && waterTotal < input.waterMinPrice) {
      waterTotal = input.waterMinPrice;
    }
  }

  // 3. Common Fee & Additional Fees
  const commonFee = input.commonFee || 0;
  const additionalTotal = input.additionalFees?.reduce((sum, fee) => sum + fee.amount, 0) || 0;
  
  // 4. Grand Total
  const grandTotal = input.roomPrice + elecTotal + waterTotal + commonFee + additionalTotal;

  return {
    elecUsage,
    elecTotal,
    elecUsageA,
    elecTotalA,
    elecUsageB,
    elecTotalB,
    waterUsage,
    waterTotal,
    commonFee,
    additionalTotal,
    grandTotal
  };
}
