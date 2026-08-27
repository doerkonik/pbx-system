import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Radio,
  Route,
  Ban,
  Disc3,
  ListTree,
  Users2,
  MapPin,
  Music,
  Users,
  ScrollText,
  Forward,
  ParkingSquare,
  Coffee,
  BarChart3,
  LineChart,
  UserCog,
  Activity,
  PhoneCall,
  FileText,
  Hash,
  PhoneIncoming,
  Voicemail,
  ClipboardList,
  PhoneForwarded,
  PhoneOutgoing,
  Gauge,
  Timer,
  ClipboardCheck,
  Star,
  History,
  ServerCog,
  Megaphone,
  Sparkles,
  ShieldCheck,
  Bot,
  SlidersHorizontal,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Section heading shown above the group (omit for the top group). */
  label?: string;
  items: NavItem[];
}

/** Admin navigation, organised into product sections. */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/realtime", label: "Realtime", icon: Activity },
    ],
  },
  {
    label: "Telephony",
    items: [
      { href: "/admin/extensions", label: "Extensions", icon: PhoneCall },
      { href: "/admin/trunks", label: "Trunks", icon: Radio },
      { href: "/admin/dids", label: "DIDs", icon: Hash },
      { href: "/admin/inbound-routes", label: "Inbound Routes", icon: PhoneIncoming },
      { href: "/admin/time-routing", label: "Time Routing", icon: Timer },
      { href: "/admin/outbound-routes", label: "Outbound Routes", icon: Route },
      { href: "/admin/queues", label: "Queues", icon: Users2 },
      { href: "/admin/ring-groups", label: "Ring Groups", icon: PhoneForwarded },
      { href: "/admin/callbacks", label: "Callbacks", icon: PhoneOutgoing },
      { href: "/admin/skills", label: "Skills", icon: Sparkles },
      { href: "/admin/ivr", label: "IVR Menus", icon: ListTree },
      { href: "/admin/conference", label: "Conference", icon: Users },
      { href: "/admin/moh", label: "Music on Hold", icon: Music },
      { href: "/admin/voicemail", label: "Voicemail", icon: Voicemail },
      { href: "/admin/misc-destinations", label: "Misc Destinations", icon: MapPin },
      { href: "/admin/blacklist", label: "Blacklist", icon: Ban },
    ],
  },
  {
    label: "AI Agent",
    items: [
      { href: "/admin/ai-studio", label: "AI Studio", icon: Bot },
      { href: "/admin/ai-control", label: "AI Control", icon: SlidersHorizontal },
      { href: "/admin/ai-analytics", label: "AI Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/cdr", label: "Call Records", icon: ScrollText },
      { href: "/admin/recordings", label: "Recordings", icon: Disc3 },
      { href: "/admin/dispositions", label: "Dispositions", icon: ClipboardList },
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/admin/call-forwarding", label: "Call Forwarding", icon: Forward },
      { href: "/admin/parking", label: "Call Parking", icon: ParkingSquare },
      { href: "/admin/breaks", label: "Breaks", icon: Coffee },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/admin/live-panel", label: "Live Panel", icon: Activity },
      { href: "/admin/monitoring", label: "Live Wallboard", icon: Gauge },
      { href: "/admin/sla-thresholds", label: "SLA Thresholds", icon: Timer },
    ],
  },
  {
    label: "Quality",
    items: [
      { href: "/admin/qa-forms", label: "QA Forms", icon: ClipboardCheck },
      { href: "/admin/qa-evaluations", label: "QA Evaluations", icon: Star },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/analytics", label: "Analytics", icon: LineChart },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/admin/security", label: "Security (2FA)", icon: ShieldCheck },
      { href: "/admin/audit", label: "Audit Log", icon: History },
      { href: "/admin/system", label: "System", icon: ServerCog },
    ],
  },
];

/** Agent navigation, organised into sections. */
export const AGENT_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/agent", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agent/calls", label: "My Calls", icon: PhoneCall },
    ],
  },
  {
    label: "Personal",
    items: [
      { href: "/agent/breaks", label: "Breaks", icon: Coffee },
      { href: "/agent/forwarding", label: "Call Forwarding", icon: Forward },
      { href: "/agent/reports", label: "My Reports", icon: FileText },
    ],
  },
];

/** Flattened lists (used to resolve the active item for the top bar). */
export const ADMIN_NAV: NavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
export const AGENT_NAV: NavItem[] = AGENT_NAV_GROUPS.flatMap((g) => g.items);
