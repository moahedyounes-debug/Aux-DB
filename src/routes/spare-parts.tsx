import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/spare-parts")({
  head: () => ({
    meta: [
      { title: "Spare Parts — AUX ASC Dashboard" },
      { name: "description", content: "Spare-parts orders, stock, lead time and impact on pending repairs." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Spare Parts"
      subtitle="Orders, stock, and lead-time impact on repairs"
      icon={Package}
      description="Bridge between pending repair tickets and the parts pipeline: what's blocked, what's on the way, and where stock is running out."
      planned={[
        "Open parts orders per ASC",
        "Tickets blocked on parts (aging)",
        "Average parts lead time",
        "Top consumed SKUs (30/90d)",
        "Low-stock alerts by warehouse",
        "Parts cost vs recovered warranty",
      ]}
    />
  ),
});