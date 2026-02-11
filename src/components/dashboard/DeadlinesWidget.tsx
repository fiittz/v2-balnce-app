import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "@/lib/mockData";

interface Deadline {
  name: string;
  date: Date;
  type: "ct1" | "form11" | "vat";
  route: string;
  status: "upcoming" | "due_soon" | "overdue";
}

function getDeadlineStatus(date: Date, now: Date): "upcoming" | "due_soon" | "overdue" {
  const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "upcoming";
}

function getDaysLabel(date: Date, now: Date): string {
  const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

function getStatusClasses(status: Deadline["status"]): string {
  switch (status) {
    case "overdue":
      return "bg-destructive text-destructive-foreground";
    case "due_soon":
      return "bg-yellow-500 text-white";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

/**
 * Build the next upcoming VAT3 bi-monthly deadlines.
 * Irish VAT3 periods: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
 * Due on the 19th of the month after period end.
 */
function getNextVATDeadlines(now: Date, year: number): Deadline[] {
  const periods = [
    { label: "Jan–Feb", due: new Date(year, 2, 19) },
    { label: "Mar–Apr", due: new Date(year, 4, 19) },
    { label: "May–Jun", due: new Date(year, 6, 19) },
    { label: "Jul–Aug", due: new Date(year, 8, 19) },
    { label: "Sep–Oct", due: new Date(year, 10, 19) },
    { label: "Nov–Dec", due: new Date(year, 0, 19) }, // Jan next year
  ];

  // Adjust Nov-Dec period to next year
  if (periods[5].due <= now) {
    periods[5].due = new Date(year + 1, 0, 19);
  }

  // Find next 2 upcoming (or overdue) deadlines
  const relevant = periods
    .map((p) => ({
      name: `VAT3 (${p.label})`,
      date: p.due,
      type: "vat" as const,
      route: "/vat",
      status: getDeadlineStatus(p.due, now),
    }))
    .filter((d) => {
      const days = Math.ceil((d.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days >= -30; // show up to 30 days overdue
    })
    .slice(0, 2);

  return relevant;
}

export function DeadlinesWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vatRegistered, setVatRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    if (isDemoMode()) {
      setVatRegistered(true);
      return;
    }
    supabase
      .from("onboarding_settings")
      .select("vat_registered")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setVatRegistered(data?.vat_registered ?? null);
      });
  }, [user]);

  const deadlines = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    // Tax year: if we're past October, deadlines are for next year
    const taxDeadlineYear = now.getMonth() >= 10 ? currentYear + 1 : currentYear;

    const all: Deadline[] = [];

    // CT1 — due 9 months after accounting year-end (default Dec 31 → Sep 21)
    const ct1 = new Date(taxDeadlineYear, 8, 21);
    all.push({
      name: "CT1 Corporation Tax",
      date: ct1,
      type: "ct1",
      route: "/tax",
      status: getDeadlineStatus(ct1, now),
    });

    // Form 11 — due October 31 (mid-November for ROS filers, but we show the standard date)
    const form11 = new Date(taxDeadlineYear, 9, 31);
    all.push({
      name: "Form 11 Income Tax",
      date: form11,
      type: "form11",
      route: "/tax",
      status: getDeadlineStatus(form11, now),
    });

    // VAT deadlines (only if VAT registered)
    if (vatRegistered) {
      all.push(...getNextVATDeadlines(now, currentYear));
    }

    // Sort: overdue first, then by date ascending
    const statusOrder = { overdue: 0, due_soon: 1, upcoming: 2 };
    all.sort((a, b) => {
      const so = statusOrder[a.status] - statusOrder[b.status];
      if (so !== 0) return so;
      return a.date.getTime() - b.date.getTime();
    });

    return all;
  }, [vatRegistered]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });

  const now = new Date();

  return (
    <Card
      className="border-0 shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300"
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-lg">Deadlines</h3>
          </div>
          <button
            onClick={() => navigate("/tax")}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Tax Centre
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {deadlines.map((d, idx) => (
            <button
              key={idx}
              onClick={() => navigate(d.route)}
              className="w-full flex items-center justify-between p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                </div>
              </div>
              <Badge className={`shrink-0 ml-2 ${getStatusClasses(d.status)}`}>
                {getDaysLabel(d.date, now)}
              </Badge>
            </button>
          ))}

          {deadlines.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No upcoming deadlines
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
