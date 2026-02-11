import { ReactNode } from "react";
import { WidgetId } from "@/types/dashboardWidgets";

interface DashboardWidgetProps {
  widgetId: WidgetId;
  isVisible: boolean;
  isLoading: boolean;
  children: ReactNode;
}

export function DashboardWidget({ isVisible, isLoading, children }: DashboardWidgetProps) {
  if (isLoading || !isVisible) return null;
  return <>{children}</>;
}
