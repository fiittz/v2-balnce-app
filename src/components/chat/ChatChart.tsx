/* eslint-disable react-refresh/only-export-components */
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#1e3a5f", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#f59e0b", "#10b981", "#ef4444"];

interface ChartData {
  type: "pie" | "bar";
  data: { name: string; value: number }[];
  title?: string;
}

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);

export function parseChartBlocks(content: string): (string | ChartData)[] {
  const parts: (string | ChartData)[] = [];
  const chartPattern = /```chart\n([\s\S]*?)\n```/g;
  let lastIndex = 0;
  let match;

  while ((match = chartPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    try {
      const chartData = JSON.parse(match[1]) as ChartData;
      parts.push(chartData);
    } catch {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

export default function ChatChart({ chart }: { chart: ChartData }) {
  if (chart.type === "pie") {
    return (
      <div className="my-2">
        {chart.title && <p className="text-xs font-semibold mb-1">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chart.data}
              cx="50%"
              cy="50%"
              outerRadius={70}
              innerRadius={35}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
              fontSize={9}
            >
              {chart.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: number) => eur(val)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "bar") {
    return (
      <div className="my-2">
        {chart.title && <p className="text-xs font-semibold mb-1">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chart.data} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <XAxis type="number" tickFormatter={(v) => eur(v)} fontSize={9} />
            <YAxis type="category" dataKey="name" width={90} fontSize={9} />
            <Tooltip formatter={(val: number) => eur(val)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chart.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
