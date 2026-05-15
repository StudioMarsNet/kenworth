'use server';

/**
 * @fileOverview A flow to analyze historical sales data and predict the impact of inventory adjustments on potential commissions.
 *
 * - forecastCommissionImpact - A function that handles the commission impact forecasting process.
 * - ForecastCommissionImpactInput - The input type for the forecastCommissionImpact function.
 * - ForecastCommissionImpactOutput - The return type for the forecastCommissionImpact function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ForecastCommissionImpactInputSchema = z.object({
  historicalSalesData: z
    .string()
    .describe(
      'Historical sales data in CSV format.  The CSV should include columns for product ID, sales date, quantity sold, and selling price.'
    ),
  inventoryAdjustments: z
    .string()
    .describe(
      'A description of potential inventory adjustments, including items to transfer or reduce and quantities.'
    ),
});
export type ForecastCommissionImpactInput = z.infer<
  typeof ForecastCommissionImpactInputSchema
>;

const ForecastCommissionImpactOutputSchema = z.object({
  predictedCommissionImpact: z.string().describe(
    'A detailed analysis of the predicted impact of the inventory adjustments on potential commissions, including specific recommendations for which items to transfer or reduce.'
  ),
});
export type ForecastCommissionImpactOutput = z.infer<
  typeof ForecastCommissionImpactOutputSchema
>;

export async function forecastCommissionImpact(
  input: ForecastCommissionImpactInput
): Promise<ForecastCommissionImpactOutput> {
  return forecastCommissionImpactFlow(input);
}

const forecastCommissionImpactPrompt = ai.definePrompt({
  name: 'forecastCommissionImpactPrompt',
  input: {schema: ForecastCommissionImpactInputSchema},
  output: {schema: ForecastCommissionImpactOutputSchema},
  prompt: `You are an expert inventory analyst specializing in forecasting the impact of inventory adjustments on potential commissions.

You will use historical sales data and proposed inventory adjustments to predict the impact on commissions.

Analyze the following historical sales data (CSV format):
{{{historicalSalesData}}}

Consider the following potential inventory adjustments:
{{{inventoryAdjustments}}}

Based on this information, provide a detailed analysis of the predicted impact of the inventory adjustments on potential commissions. Include specific recommendations for which items to transfer or reduce to maximize commission while minimizing stockouts. Focus on identifying products that are likely to stagnate in inventory and/or be popular.
`,
});

const forecastCommissionImpactFlow = ai.defineFlow(
  {
    name: 'forecastCommissionImpactFlow',
    inputSchema: ForecastCommissionImpactInputSchema,
    outputSchema: ForecastCommissionImpactOutputSchema,
  },
  async input => {
    const {output} = await forecastCommissionImpactPrompt(input);
    return output!;
  }
);
