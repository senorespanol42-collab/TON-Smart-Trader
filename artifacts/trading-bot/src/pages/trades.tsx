import { useGetTrades, getGetTradesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function Trades() {
  const { data: trades, isLoading } = useGetTrades({ limit: 50 }, { query: { queryKey: getGetTradesQueryKey({ limit: 50 }) } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Trade History</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pair</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Entry / Exit</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Closed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              )}
              {trades?.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-bold">{trade.pair}</TableCell>
                  <TableCell>
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", trade.side === 'long' ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive")}>
                      {trade.side} {trade.leverage}x
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(trade.entryPrice, 4)} → {formatNumber(trade.exitPrice, 4)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(trade.sizeUsd)}</TableCell>
                  <TableCell className="text-right">
                    <div className={cn("font-bold", trade.realizedPnlUsd >= 0 ? "text-green-500" : "text-destructive")}>
                      {trade.realizedPnlUsd >= 0 ? "+" : ""}{formatCurrency(trade.realizedPnlUsd)}
                    </div>
                    <div className={cn("text-xs", trade.realizedPnlPercent >= 0 ? "text-green-500" : "text-destructive")}>
                      {trade.realizedPnlPercent >= 0 ? "+" : ""}{formatNumber(trade.realizedPnlPercent, 2)}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px]">{trade.exitReason.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full", trade.confluenceScore > 75 ? "bg-green-500" : trade.confluenceScore > 50 ? "bg-yellow-500" : "bg-destructive")} style={{ width: `${trade.confluenceScore}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{formatNumber(trade.confluenceScore, 0)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(trade.closedAt)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && !trades?.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No trades found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
