import { useGetBotStatus, getGetBotStatusQueryKey, useStartBot, useStopBot, usePauseBot, useGetPositions, getGetPositionsQueryKey, useGetCurrentSignal, getGetCurrentSignalQueryKey, useGetLogs, getGetLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { Activity, Play, Square, Pause, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: status } = useGetBotStatus({ query: { queryKey: getGetBotStatusQueryKey(), refetchInterval: 3000 } });
  const { data: positions } = useGetPositions({ query: { queryKey: getGetPositionsQueryKey(), refetchInterval: 3000 } });
  const { data: signal } = useGetCurrentSignal({ pair: status?.activePair || "TON/USDT" }, { query: { queryKey: getGetCurrentSignalQueryKey({ pair: status?.activePair || "TON/USDT" }), refetchInterval: 3000, enabled: !!status?.activePair } });
  const { data: logs } = useGetLogs({ limit: 5 }, { query: { queryKey: getGetLogsQueryKey({ limit: 5 }), refetchInterval: 5000 } });
  
  const startBot = useStartBot();
  const stopBot = useStopBot();
  const pauseBot = usePauseBot();
  const { toast } = useToast();

  const handleStart = () => {
    startBot.mutate(undefined, {
      onSuccess: () => toast({ title: "Bot started" })
    });
  };

  const handleStop = () => {
    stopBot.mutate(undefined, {
      onSuccess: () => toast({ title: "Bot stopped" })
    });
  };

  const handlePause = () => {
    pauseBot.mutate(undefined, {
      onSuccess: () => toast({ title: "Bot paused" })
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex space-x-2">
          <Button variant={status?.state === "running" ? "default" : "outline"} size="sm" onClick={handleStart} disabled={status?.state === "running" || startBot.isPending}>
            <Play className="h-4 w-4 mr-1" /> Start
          </Button>
          <Button variant={status?.state === "paused" ? "default" : "outline"} size="sm" onClick={handlePause} disabled={status?.state === "paused" || status?.state === "stopped" || pauseBot.isPending}>
            <Pause className="h-4 w-4 mr-1" /> Pause
          </Button>
          <Button variant="destructive" size="sm" onClick={handleStop} disabled={status?.state === "stopped" || stopBot.isPending}>
            <Square className="h-4 w-4 mr-1" /> Stop
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold uppercase">{status?.state || "UNKNOWN"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Uptime: {status?.uptime ? `${Math.floor(status.uptime / 60)}m` : "0m"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", (status?.dailyPnlUsd || 0) >= 0 ? "text-green-500" : "text-destructive")}>
              {formatCurrency(status?.dailyPnlUsd)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status?.totalTrades || 0} trades today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.openPositions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active Pair: {status?.activePair || "None"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Signal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold uppercase">{signal?.signal || "WAITING"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Confidence: {signal?.confluenceScore ? formatNumber(signal.confluenceScore, 0) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs?.map((log) => (
                <div key={log.id} className="flex items-start space-x-3 text-sm">
                  {log.level === 'error' ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> : <div className="h-4 w-4 rounded-full bg-primary/20 shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={cn(
                      log.level === 'error' && "text-destructive font-medium",
                      log.level === 'warn' && "text-yellow-500",
                    )}>
                      {log.message}
                    </span>
                  </div>
                </div>
              ))}
              {!logs?.length && (
                <div className="text-muted-foreground text-sm text-center py-4">No recent logs</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {positions?.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", pos.side === 'long' ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive")}>
                        {pos.side}
                      </span>
                      <span className="font-bold">{pos.pair}</span>
                      <span className="text-xs text-muted-foreground">{pos.leverage}x</span>
                    </div>
                    <div className="text-sm mt-1">
                      Entry: {formatNumber(pos.entryPrice, 4)} → Mark: {formatNumber(pos.currentPrice, 4)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("font-bold", pos.unrealizedPnlUsd >= 0 ? "text-green-500" : "text-destructive")}>
                      {pos.unrealizedPnlUsd >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlUsd)}
                    </div>
                    <div className={cn("text-xs", pos.unrealizedPnlPercent >= 0 ? "text-green-500" : "text-destructive")}>
                      {pos.unrealizedPnlPercent >= 0 ? "+" : ""}{formatNumber(pos.unrealizedPnlPercent, 2)}%
                    </div>
                  </div>
                </div>
              ))}
              {!positions?.length && (
                <div className="text-muted-foreground text-sm text-center py-4">No open positions</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
