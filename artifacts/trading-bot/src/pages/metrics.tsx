import { useGetMetricsSummary, getGetMetricsSummaryQueryKey, useGetPerformance, getGetPerformanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent, cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Metrics() {
  const { data: summary } = useGetMetricsSummary({ query: { queryKey: getGetMetricsSummaryQueryKey() } });
  const { data: performance } = useGetPerformance({ period: "30d" }, { query: { queryKey: getGetPerformanceQueryKey({ period: "30d" }) } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Performance Metrics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", (summary?.totalPnlUsd || 0) >= 0 ? "text-green-500" : "text-destructive")}>
              {summary?.totalPnlUsd >= 0 ? "+" : ""}{formatCurrency(summary?.totalPnlUsd)}
            </div>
            <p className="text-xs text-muted-foreground">{summary?.totalPnlPercent >= 0 ? "+" : ""}{formatNumber(summary?.totalPnlPercent, 2)}% all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary?.winRate, 1)}%</div>
            <p className="text-xs text-muted-foreground">{summary?.winningTrades} W / {summary?.losingTrades} L</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary?.profitFactor, 2)}</div>
            <p className="text-xs text-muted-foreground">Gross Win / Gross Loss</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">-{formatNumber(summary?.maxDrawdownPercent, 2)}%</div>
            <p className="text-xs text-muted-foreground">Peak to trough</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Equity Curve (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {performance?.equityCurve && performance.equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performance.equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="timestamp" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} domain={['auto', 'auto']} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                      formatter={(v: number) => [formatCurrency(v), 'Equity']}
                    />
                    <Line type="monotone" dataKey="equityUsd" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily P&L (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {performance?.pnlByDay && performance.pnlByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performance.pnlByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                      formatter={(v: number) => [formatCurrency(v), 'P&L']}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                    />
                    <Bar dataKey="pnlUsd" radius={[2, 2, 0, 0]}>
                      {
                        performance.pnlByDay.map((entry, index) => (
                          <cell key={`cell-${index}`} fill={entry.pnlUsd >= 0 ? 'hsl(152 100% 50%)' : 'hsl(345 100% 60%)'} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
