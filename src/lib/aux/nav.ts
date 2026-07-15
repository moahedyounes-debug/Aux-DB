import {
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  CalendarClock,
  AlarmClock,
  Microscope,
  Boxes,
  Package,
  Headphones,
  PhoneForwarded,
  PhoneCall,
  Wrench,
  Hammer,
  Building2,
  Undo2,
  MapPin,
  Wallet,
  Coins,
  Scale,
  Smile,
  MessageCircle,
  Truck,
  Download,
  History,
  LayoutGrid,
  Settings2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavPage {
  path: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
  active?: boolean;
}

export const NAV_PAGES: NavPage[] = [
  { path: "/", label: "KPI Overview", icon: LayoutDashboard, active: true },
  { path: "/kpis", label: "KPI Scorecard", icon: ClipboardList, active: true },
  { path: "/monthly-trends", label: "Monthly Trends", icon: TrendingUp, active: true },
  { path: "/daily-operations", label: "Daily Operations", icon: CalendarClock, active: true },
  { path: "/pending-analysis", label: "Pending Analysis", icon: AlarmClock, active: true },
  { path: "/deep-insights", label: "Deep Insights", icon: Microscope },
  { path: "/obm-analysis", label: "OBM Analysis", icon: Boxes },
  { path: "/spare-parts", label: "Spare Parts", icon: Package },
  { path: "/call-center", label: "Call Center", icon: Headphones, active: true },
  { path: "/call-center-assignment", label: "Call Assignment", icon: PhoneForwarded },
  { path: "/call-events", label: "Call Events", icon: PhoneCall },
  { path: "/ticket-repair-history", label: "Repair History", icon: Wrench },
  { path: "/installation-analysis", label: "Installation Analysis", icon: Hammer },
  { path: "/asc-performance", label: "ASC Performance", icon: Building2 },
  { path: "/rejected-returned", label: "Rejected / Returned", icon: Undo2 },
  { path: "/city", label: "City Breakdown", icon: MapPin },
  { path: "/districts-map", label: "Districts Map", icon: MapPin },
  { path: "/warranty-payments", label: "Warranty Payments", icon: Wallet },
  { path: "/costs", label: "Cost Center", icon: Coins },
  { path: "/commerce-complaints", label: "Commerce Complaints", icon: Scale },
  { path: "/satisfaction", label: "Satisfaction (CSAT)", icon: Smile },
  { path: "/whatsapp", label: "WhatsApp Inbox", icon: MessageCircle },
  { path: "/shipments", label: "Shipments", icon: Truck },
  { path: "/export-center", label: "Export Center", icon: Download },
  { path: "/activity-log", label: "Activity Log", icon: History },
  { path: "/custom-dashboard", label: "Custom Dashboard", icon: LayoutGrid },
  { path: "/control-panel", label: "Control Panel", icon: Settings2, admin: true },
  { path: "/access", label: "Access", icon: ShieldCheck, admin: true },
];