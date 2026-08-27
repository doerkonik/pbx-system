/**
 * Shared design-system component library.
 * Import from "@/components/ui" throughout the app.
 */

// Primitives
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";

export { Textarea } from "./Textarea";
export type { TextareaProps } from "./Textarea";

export { Toggle, Switch } from "./Toggle";
export type { ToggleProps } from "./Toggle";

export { Spinner } from "./Spinner";
export type { SpinnerProps } from "./Spinner";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeVariant } from "./Badge";

export { Avatar } from "./Avatar";
export type { AvatarProps } from "./Avatar";

export { IconBadge } from "./IconBadge";
export type { IconBadgeProps, IconBadgeTone } from "./IconBadge";

export { CountBadge } from "./CountBadge";
export type { CountBadgeProps, CountBadgeTone } from "./CountBadge";

export { GradientChip } from "./GradientChip";
export type { GradientChipProps } from "./GradientChip";

// Layout / surfaces
export { Card, CardHeader, KpiRow } from "./Card";
export type { CardProps, CardHeaderProps, KpiRowProps } from "./Card";

export { PageHeader } from "./PageHeader";
export type { PageHeaderProps, BreadcrumbItem } from "./PageHeader";

export { Tabs } from "./Tabs";
export type { TabsProps, TabItem } from "./Tabs";

// Data display
export { StatCard } from "./StatCard";
export type { StatCardProps, StatCardTrend, StatCardPill } from "./StatCard";

// Warm HR/Ops design-system cards
export { KPICard } from "./KPICard";
export type { KPICardProps, KpiTone } from "./KPICard";

export { ScoreCard } from "./ScoreCard";
export type { ScoreCardProps } from "./ScoreCard";

export { RankedListCard } from "./RankedListCard";
export type { RankedListCardProps, RankedItem } from "./RankedListCard";

export { DarkInfoCard, DarkInfoItem } from "./DarkInfoCard";
export type { DarkInfoCardProps, DarkInfoItemProps, DarkDot } from "./DarkInfoCard";

export { ProgressBar } from "./ProgressBar";
export type { ProgressBarProps, BarTone } from "./ProgressBar";

export { TopProfileChip } from "./TopProfileChip";
export type { TopProfileChipProps } from "./TopProfileChip";

export { ProgressRing } from "./ProgressRing";
export type { ProgressRingProps } from "./ProgressRing";

export { StatusPill } from "./StatusPill";
export type { StatusPillProps, StatusPillVariant } from "./StatusPill";

export { StatusListRow } from "./StatusListRow";
export type { StatusListRowProps } from "./StatusListRow";

export { RosterRow } from "./RosterRow";
export type { RosterRowProps } from "./RosterRow";

export { TabbedChartCard } from "./TabbedChartCard";
export type { TabbedChartCardProps } from "./TabbedChartCard";

export { DataTable } from "./DataTable";
export type {
  DataTableProps,
  Column,
  SortState,
  SortDirection,
  DataTablePagination,
} from "./DataTable";

// Feedback / overlays
export { Modal, Dialog } from "./Modal";
export type { ModalProps, ModalSize } from "./Modal";

export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";

export {
  ToastProvider,
  Toaster,
  useToast,
} from "./Toast";
export type { ToastOptions, ToastVariant } from "./Toast";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { ErrorState } from "./ErrorState";
export type { ErrorStateProps } from "./ErrorState";
