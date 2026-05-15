"use server";

import { forecastCommissionImpact } from "@/ai/flows/forecast-commission-impact";

type FormState = {
  predictedCommissionImpact: string;
  error: string;
};

export async function getForecast(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const historicalSalesData = formData.get("historicalSalesData") as string;
  const inventoryAdjustments = formData.get("inventoryAdjustments") as string;

  if (!historicalSalesData || !inventoryAdjustments) {
    return {
      predictedCommissionImpact: "",
      error: "Both historical data and inventory adjustments are required.",
    };
  }

  try {
    const result = await forecastCommissionImpact({
      historicalSalesData,
      inventoryAdjustments,
    });
    return {
      predictedCommissionImpact: result.predictedCommissionImpact,
      error: "",
    };
  } catch (e) {
    console.error(e);
    return {
      predictedCommissionImpact: "",
      error: "Failed to generate forecast. Please try again later.",
    };
  }
}
