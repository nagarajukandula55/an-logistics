"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export function OrdersTrendChart({ data }: { data: { day: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -20, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="count" name="Orders" stroke={COLORS[0]} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusBreakdownChart({ data }: { data: { status: string; count: number }[] }) {
  const nonZero = data.filter((d) => d.count > 0);
  if (nonZero.length === 0) return <p className="text-sm text-ink-3">No orders yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={nonZero}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(entry: unknown) => {
            const e = entry as { status?: string; count?: number };
            return `${e.status}: ${e.count}`;
          }}
        >
          {nonZero.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CourierVolumeChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: -20, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" name="Orders" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TenantBreakdownChart({ data }: { data: { name: string; type: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
        <Tooltip />
        <Bar dataKey="count" name="Orders" fill={COLORS[4]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
