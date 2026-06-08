import {
  useGetBotStatus,
  getGetBotStatusQueryKey,
  useStartBot,
  useStopBot,
  usePauseBot,
  useStartTheoreticalBot,
  useStopTheoreticalBot,
  useGetPositions,
  getGetPositionsQueryKey,
  useGetCurrentSignal,
  getGetCurrentSignalQueryKey,
  useGetLogs,
  getGetLogsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { Activity, Play, Square, Pause, AlertTriangle, FlaskConical, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: status } = useGetBotStatus({
    query: { queryKey: getGetBotStatusQueryKey(), refetchInterval: 3000 },
  });
  const { data: positions } = useGetPositions({
    query: { queryKey: getGetPositionsQueryKey(), refetchInterval: 3000 },
  });
  const { data: signal } = useGetCurrentSignal(
    { pair: status?.activePair || "TON/USDT" },
    {
      query: {
        queryKey: getGetCurrentSignalQueryKey({ pair: status?.activePair || "TON/USDT" }),
        refetchInterval: 3000,
        enabled: !!status?.activePair,
      },
    },
  );
  const { data: logs } = useGetLogs(
    { limit: 5 },
    { query: { queryKey: getGetLogsQueryKey({ limit: 5 }), refetchInterval: 5000 } },
  );

  const startBot            = useStartBot();
  const stopBot             = useStopBot();
  const pauseBot            = usePauseBot();
  const startTheoreticalBot = useStartTheoreticalBot();
  const stopTheoreticalBot  = useStopTheoreticalBot();
  const { toast }           = useToast();

  const isRunning     = status?.state === "running";
  const isPaused      = status?.state === "paused";
  const isStopped     = status?.state === "stopped" || !status;
  const isTheoretical = status?.theoreticalMode ?? false;
  const theorBalance  = status?.theoreticalBalance ?? null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
  }

  const handleStart = () =>
    startBot.mutate(undefined, {
      onSuccess: () => { toast({ title: "Bot started — real trading mode" }); invalidate(); },
    });

  const handleStop = () =>
    stopBot.mutate(undefined, {
      onSuccess: () => { toast({ title: "Bot stopped" }); invalidate(); },
    });

  const handlePause = () =>
    pauseBot.mutate(undefined, {
      onSuccess: () => { toast({ title: "Bot paused" }); invalidate(); },
    });

  const handleTheoreticalStart = () =>
    startTheoreticalBot.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Theoretical mode started", description: "$1,000 virtual balance — no wallet needed" });
        invalidate();
      },
    });

  const handleTheoreticalStop = () =>
    stopTheoreticalBot.mutate(undefined, {
      onSuccess: () => { toast({ title: "Theoretical mode stopped" }); invalidate(); },
    });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          {isTheoretical && (
            <Badge variant="secondary" className="gap-1 bg-violet-500/20 text-violet-400 border-violet-500/30">
              <FlaskConical className="h-3 w-3" /> Theoretical Mode
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* ── Real trading controls ── */}
          <div className="flex gap-1 border rounded-md p-1 bg-background">
            <Button
              variant={isRunning && !isTheoretical ? "default" : "ghost"}
              size="sm"
              onClick={handleStart}
              disabled={isRunning || startBot.isPending}
            >
              <Play className="h-3.5 w-3.5 mr-1" /> Start
            </Button>
            <Button
              variant={isPaused ? "default" : "ghost"}
              size="sm"
              onClick={handlePause}
              disabled={isPaused || isStopped || pauseBot.isPending}
            >
              <Pause className="h-3.5 w-3.5 mr-1" /> Pause
            </Button>
            <Button
              variant={isStopped ? "ghost" : "destructive"}
              size="sm"
              onClick={handleStop}
              disabled={isStopped || stopBot.isPending}
            >
              <Square className="h-3.5 w-3.5 mr-1" /> Stop
            </Button>
          </div>

          {/* ── Theoretical mode control ── */}
          {!isTheoretical ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTheoreticalStart}
              disabled={isRunning || startTheoreticalBot.isPending}
              className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
            >
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              Run Theoretical ($1k sim)
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTheoreticalStop}
              disabled={stopTheoreticalBot.isPending}
              className="border-violet-500/40 text-violet-400 hover:bg-red-500/10 hover:text-red-400"
            >
              <Square className="h-3.5 w-3.5 mr-1.5" />
              Stop Simulation
            </Button>
          )}
        </div>
      </div>

      {/* ── Theoretical mode info banner ── */}
      {isTheoretical && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-sm text-violet-300 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0" />
          <span>
            <strong>Theoretical mode:</strong> Paper trading with $1,000 virtual balance. Uses exact Storm Trade fees
            (0.06% open + 0.06% close on notional). No real funds — no wallet required.
          </span>
        </div>
      )}

      {/* ── Stats cards ── */}
      <div className={cn("grid grid-cols-1 gap-4", isTheoretical ? "md:grid-cols-2 lg:grid-cols-5" : "md:grid-cols-2 lg:grid-cols-4")}>
        <Card className={cn(isTheoretical && "border-violet-500/30")}>
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

        {/* Virtual balance — only in theoretical mode */}
        {isTheoretical && (
          <Card className="border-violet-500/30 bg-violet-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-violet-300">Virtual Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-violet-400" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                theorBalance == null ? "text-muted-foreground"
                  : theorBalance >= 1000 ? "text-green-500"
                  : theorBalance >= 800 ? "text-yellow-500"
                  : "text-destructive",
              )}>
                {theorBalance != null ? formatCurrency(theorBalance) : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {theorBalance != null
                  ? `${theorBalance >= 1000 ? "+" : ""}${formatNumber(theorBalance - 1000, 2)} vs start`
                  : "Started at $1,000"}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTheoretical ? "Sim P&L" : "Daily P&L"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", (status?.dailyPnlUsd || 0) >= 0 ? "text-green-500" : "text-destructive")}>
              {formatCurrency(status?.dailyPnlUsd)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status?.totalTrades || 0} trades{isTheoretical ? " (simulated)" : " today"}
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

      {/* ── Logs + Positions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs?.map((log) => (
                <div key={log.id} className="flex items-start space-x-3 text-sm">
                  {log.level === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-primary/20 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={cn(
                        log.level === "error" && "text-destructive font-medium",
                        log.level === "warn" && "text-yellow-500",
                        log.message?.startsWith("[SIM]") && "text-violet-400",
                      )}
                    >
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
                <div key={pos.id} className={cn("flex items-center justify-between p-3 border rounded-md", pos.isTheoretical && "border-violet-500/30 bg-violet-500/5")}>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-bold uppercase",
                          pos.side === "long" ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive",
                        )}
                      >
                        {pos.side}
                      </span>
                      <span className="font-bold">{pos.pair}</span>
                      <span className="text-xs text-muted-foreground">{pos.leverage}x</span>
                      {pos.isTheoretical && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-400">
                          SIM
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-1">
                      Entry: {formatNumber(pos.entryPrice, 4)} → Mark: {formatNumber(pos.currentPrice, 4)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("font-bold", pos.unrealizedPnlUsd >= 0 ? "text-green-500" : "text-destructive")}>
                      {pos.unrealizedPnlUsd >= 0 ? "+" : ""}
                      {formatCurrency(pos.unrealizedPnlUsd)}
                    </div>
                    <div className={cn("text-xs", pos.unrealizedPnlPercent >= 0 ? "text-green-500" : "text-destructive")}>
                      {pos.unrealizedPnlPercent >= 0 ? "+" : ""}
                      {formatNumber(pos.unrealizedPnlPercent, 2)}%
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
