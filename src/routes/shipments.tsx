import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/shipments")({
  head: () => ({
    meta: [
      { title: "Shipments — AUX ASC Dashboard" },
      { name: "description", content: "Unit movements: replacement, return-to-warehouse, parts shipments and courier SLA." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Shipments"
      subtitle="Units and parts in transit"
      icon={Truck}
      description="Movement of units and parts across the ASC network — replacements to customer, returns to warehouse, and courier performance."
      planned={[
        "In-transit shipments",
        "Courier on-time %",
        "Replacement units by city",
        "Return-to-warehouse aging",
        "Cost per shipment",
        "Damaged-in-transit register",
      ]}
    />
  ),
});