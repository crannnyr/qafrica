// src/components/developer/UsageChart.tsx
// Renders a bar chart of daily API usage.
// Uses recharts — already in the project's dependencies.

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { ApiUsageDataPoint } from '@/types/developer';

interface UsageChartProps {
  data:     ApiUsageDataPoint[];
  isLoading?: boolean;
  height?:  number;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 shadow-xl">
      <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-gray-300 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// Loading skeleton bars
function SkeletonBars({ count = 14 }: { count?: number }) {
  return (
    <div className="flex items-end gap-1.5 h-full pb-6 px-2">
      {Array.from({ length: count }).map((_, i) => {
        const h = 20 + Math.random() * 70;
        return (
          <div
            key={i}
            className="flex-1 bg-gray-100 rounded-t animate-pulse"
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

export function UsageChart({
  data,
  isLoading = false,
  height = 180,
}: UsageChartProps) {
  if (isLoading) {
    return (
      <div style={{ height }} className="w-full">
        <SkeletonBars />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center"
      >
        <p className="text-sm text-gray-400">No usage data yet.</p>
      </div>
    );
  }

  // Format date for X-axis label
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short',
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formatted} barGap={2} barCategoryGap="30%">
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#F3F4F6"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }}
        />
        <Bar
          dataKey="requests"
          name="Requests"
          fill="#F97316"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          dataKey="errors"
          name="Errors"
          fill="#FCA5A5"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default UsageChart;