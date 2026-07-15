import { createFileRoute } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/costs")({
  head: () => ({
    meta: [
      { title: "Cost Center — AUX ASC Dashboard" },
      { name: "description", content: "Labour, parts, logistics and warranty cost per ticket and per branch." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Cost Center"
      subtitle="Cost per ticket, per branch, per product"
      icon={Coins}
      description="Roll up labour, parts, logistics and reimbursements into a single cost view — with margin tracking against warranty rates."
      planned={[
        "Cost per completed ticket",
        "Labour vs parts vs logistics mix",
        "Cost per product line",
        "Branch cost efficiency ranking",
        "Budget vs actual monthly",
        "Reimbursement gap tracker",
      ]}
    />
  ),
});