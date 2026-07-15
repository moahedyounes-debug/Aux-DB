import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/warranty-payments")({
  head: () => ({
    meta: [
      { title: "Warranty Payments — AUX ASC Dashboard" },
      { name: "description", content: "Warranty claim payouts to ASC partners: submitted, approved, paid." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Warranty Payments"
      subtitle="Claims submitted, approved, and paid"
      icon={Wallet}
      description="Reconcile warranty claims against ASC payouts — what's still pending approval, what's held back for missing docs, and monthly payout run."
      planned={[
        "Claims funnel: submitted → paid",
        "Aging of pending payouts",
        "Deductions & short-pay reasons",
        "Payout per ASC per month",
        "Rejected claim recovery",
        "Monthly reconciliation export",
      ]}
    />
  ),
});