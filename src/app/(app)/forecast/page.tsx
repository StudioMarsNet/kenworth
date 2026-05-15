import { PageHeader } from "@/components/page-header";
import { ForecastForm } from "./forecast-form";

export default function ForecastPage() {
  return (
    <>
      <PageHeader
        title="AI Trend Forecast"
        description="Leverage AI to analyze trends and predict the impact of inventory changes on commissions."
      />
      <ForecastForm />
    </>
  );
}
