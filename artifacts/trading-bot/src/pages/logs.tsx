import { useState } from "react";
import { useGetLogs, getGetLogsQueryKey } from "@workspace/api-client-react";
import type { GetLogsLevel } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, cn } from "@/lib/utils";
import { AlertTriangle, Info, ShieldAlert, Terminal, Activity, Target } from "lucide-react";

export default function Logs() {
  const [level, setLevel] = useState<GetLogsLevel | "all">("all");
  
  const queryParams = { limit: 100, ...(level !== "all" ? { level: level as GetLogsLevel } : {}) };
  const { data: logs, isLoading } = useGetLogs(queryParams, { query: { queryKey: getGetLogsQueryKey(queryParams), refetchInterval: 5000 } });

  const getIcon = (lvl: string, category: string) => {
    if (lvl === "error") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (category === "risk") return <ShieldAlert className="h-4 w-4 text-yellow-500" />;
    if (category === "signal") return <Target className="h-4 w-4 text-primary" />;
    if (category === "market") return <Activity className="h-4 w-4 text-blue-500" />;
    if (lvl === "info") return <Info className="h-4 w-4 text-muted-foreground" />;
    return <Terminal className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">System Logs</h1>
        <div className="flex items-center space-x-2">
          <Select value={level || "all"} onValueChange={(val) => setLevel(val as GetLogsLevel | "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-card">
        <CardContent className="p-0 flex-1 overflow-y-auto font-mono text-sm">
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading logs...</div>}
          <div className="divide-y divide-border/50">
            {logs?.map((log) => (
              <div key={log.id} className="p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                <div className="shrink-0 mt-0.5">
                  {getIcon(log.level, log.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                      log.level === 'error' ? "bg-destructive/20 text-destructive" :
                      log.level === 'warn' ? "bg-yellow-500/20 text-yellow-500" :
                      log.level === 'debug' ? "bg-muted text-muted-foreground" :
                      "bg-primary/20 text-primary"
                    )}>
                      {log.level}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      [{log.category}]
                    </span>
                  </div>
                  <div className={cn(
                    "break-words",
                    log.level === 'error' && "text-destructive font-medium",
                    log.level === 'warn' && "text-yellow-500"
                  )}>
                    {log.message}
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="mt-2 text-xs bg-background/50 p-2 rounded border border-border/50 overflow-x-auto text-muted-foreground">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
            {!isLoading && !logs?.length && (
              <div className="p-8 text-center text-muted-foreground">No logs found matching criteria.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
