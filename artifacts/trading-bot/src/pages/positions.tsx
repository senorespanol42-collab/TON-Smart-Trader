import { useGetPositions, getGetPositionsQueryKey, useClosePosition } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Positions() {
  const { data: positions, isLoading } = useGetPositions({ query: { queryKey: getGetPositionsQueryKey(), refetchInterval: 3000 } });
  const closePosition = useClosePosition();
  const { toast } = useToast();

  const handleClose = (id: string) => {
    closePosition.mutate({ positionId: id }, {
      onSuccess: () => toast({ title: "Position closed successfully" }),
      onError: () => toast({ title: "Failed to close position", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Open Positions</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pair</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Entry Price</TableHead>
                <TableHead className="text-right">Mark Price</TableHead>
                <TableHead className="text-right">Unrealized P&L</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              )}
              {positions?.map((pos) => (
                <TableRow key={pos.id}>
                  <TableCell className="font-bold">{pos.pair}</TableCell>
                  <TableCell>
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", pos.side === 'long' ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive")}>
                      {pos.side} {pos.leverage}x
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(pos.sizeUsd)}</TableCell>
                  <TableCell className="text-right">{formatNumber(pos.entryPrice, 4)}</TableCell>
                  <TableCell className="text-right">{formatNumber(pos.currentPrice, 4)}</TableCell>
                  <TableCell className="text-right">
                    <div className={cn("font-bold", pos.unrealizedPnlUsd >= 0 ? "text-green-500" : "text-destructive")}>
                      {pos.unrealizedPnlUsd >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlUsd)}
                    </div>
                    <div className={cn("text-xs", pos.unrealizedPnlPercent >= 0 ? "text-green-500" : "text-destructive")}>
                      {pos.unrealizedPnlPercent >= 0 ? "+" : ""}{formatNumber(pos.unrealizedPnlPercent, 2)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(pos.openedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => handleClose(pos.id)} disabled={closePosition.isPending}>
                      Close
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !positions?.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No open positions.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
