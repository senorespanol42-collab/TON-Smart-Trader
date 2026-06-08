import { useGetOrders, getGetOrdersQueryKey, useCancelOrder } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Orders() {
  const { data: orders, isLoading } = useGetOrders({ query: { queryKey: getGetOrdersQueryKey(), refetchInterval: 5000 } });
  const cancelOrder = useCancelOrder();
  const { toast } = useToast();

  const handleCancel = (id: string) => {
    cancelOrder.mutate({ orderId: id }, {
      onSuccess: () => toast({ title: "Order cancelled successfully" }),
      onError: () => toast({ title: "Failed to cancel order", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Pending Orders</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pair</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              )}
              {orders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-bold">{order.pair}</TableCell>
                  <TableCell className="uppercase text-xs font-bold">{order.type}</TableCell>
                  <TableCell>
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", order.side === 'long' ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive")}>
                      {order.side}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(order.price, 4)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.sizeUsd)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {order.status === 'pending' && (
                      <Button variant="outline" size="sm" onClick={() => handleCancel(order.id)} disabled={cancelOrder.isPending}>
                        Cancel
                      </Button>
                    )}
                    {order.status !== 'pending' && (
                      <span className="text-xs uppercase text-muted-foreground">{order.status}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !orders?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pending orders.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
