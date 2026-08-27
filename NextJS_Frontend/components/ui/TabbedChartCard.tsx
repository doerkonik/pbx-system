"use client";

import { useState } from "react";
import { Card, CardHeader } from "./Card";
import { Tabs, type TabItem } from "./Tabs";

export interface TabbedChartCardProps<T extends string = string> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  tabs: TabItem<T>[];
  /** Controlled active tab. Omit to use internal state. */
  value?: T;
  /** Change handler for controlled usage. */
  onChange?: (value: T) => void;
  /** Default tab for uncontrolled usage. Defaults to first tab. */
  defaultValue?: T;
  /** Render the chart for the active tab. Wrap your recharts component here. */
  children: (activeTab: T) => React.ReactNode;
  /** Right-aligned header actions (e.g. export). */
  actions?: React.ReactNode;
  /** Tab visual style. */
  tabVariant?: "underline" | "pill";
  /** Fixed height for the chart area (px). Defaults to 260. */
  height?: number;
  className?: string;
}

/**
 * Chart card with a tab switcher in the header. Wraps recharts (or any chart).
 * Tabs like Answered/Missed or Day/Week/Month/Year.
 *
 * @example
 * <TabbedChartCard title="Calls" tabs={[{value:"answered",label:"Answered"}]}>
 *   {(tab) => <ResponsiveContainer>...</ResponsiveContainer>}
 * </TabbedChartCard>
 */
export function TabbedChartCard<T extends string = string>({
  title,
  subtitle,
  tabs,
  value,
  onChange,
  defaultValue,
  children,
  actions,
  tabVariant = "pill",
  height = 260,
  className,
}: TabbedChartCardProps<T>) {
  const [internal, setInternal] = useState<T>(
    defaultValue ?? tabs[0]?.value,
  );
  const active = value ?? internal;

  const handleChange = (v: T) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  };

  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            {actions}
            <Tabs
              tabs={tabs}
              value={active}
              onChange={handleChange}
              variant={tabVariant}
              size="sm"
            />
          </div>
        }
      />
      <div style={{ height }} className="w-full">
        {children(active)}
      </div>
    </Card>
  );
}
