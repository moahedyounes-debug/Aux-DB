import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/obm-analysis")({
  head: () => ({
    meta: [
      { title: "OBM Analysis — AUX ASC Dashboard" },
      { name: "description", content: "Out-of-Box Malfunction analysis across product lines and cities." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="OBM Analysis"
      subtitle="Out-of-Box Malfunction tracking"
      icon={Boxes}
      description="Track units reported as defective on first install, split by product line, batch, city and dealer — feeds quality and warranty processes."
      planned={[
        "OBM rate per product line",
        "Top failing components / symptoms",
        "Batch / production month heatmap",
        "Dealer & city concentration",
        "Replacement vs repair outcome",
        "Trend vs previous period",
      ]}
    />
  ),
});