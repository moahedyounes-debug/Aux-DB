import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Inbox — AUX ASC Dashboard" },
      { name: "description", content: "Unified WhatsApp inbox for customer support, tied to service tickets." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="WhatsApp Inbox"
      subtitle="Customer conversations, tied to tickets"
      icon={MessageCircle}
      description="Central WhatsApp Business inbox that links every conversation back to its ticket, with response-time metrics and template messaging."
      planned={[
        "Threaded inbox by ticket",
        "First-response time SLA",
        "Template message library",
        "Media attachments per ticket",
        "Auto-reply outside working hours",
        "Escalation to agent",
      ]}
    />
  ),
});