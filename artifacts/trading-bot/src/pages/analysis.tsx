import { useGetMarketPrice, getGetMarketPriceQueryKey, useGetKeyLevels, getGetKeyLevelsQueryKey, useGetSupplyDemandZones, getGetSupplyDemandZonesQueryKey, useGetMarketStructure, getGetMarketStructureQueryKey, useGetCurrentSignal, getGetCurrentSignalQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function Analysis() {
  const defaultPair = "TON/USDT";
  
  const { data: price } = useGetMarketPrice({ pair: defaultPair }, { query: { queryKey: getGetMarketPriceQueryKey({ pair: defaultPair }), refetchInterval: 3000 } });
  const { data: signal } = useGetCurrentSignal({ pair: defaultPair }, { query: { queryKey: getGetCurrentSignalQueryKey({ pair: defaultPair }), refetchInterval: 3000 } });
  const { data: levels } = useGetKeyLevels({ pair: defaultPair }, { query: { queryKey: getGetKeyLevelsQueryKey({ pair: defaultPair }) } });
  const { data: zones } = useGetSupplyDemandZones({ pair: defaultPair }, { query: { queryKey: getGetSupplyDemandZonesQueryKey({ pair: defaultPair }) } });
  const { data: structure } = useGetMarketStructure({ pair: defaultPair }, { query: { queryKey: getGetMarketStructureQueryKey({ pair: defaultPair }) } });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Market Analysis</h1>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{defaultPair}</div>
            <div className="text-xl font-bold font-mono">{formatNumber(price?.price, 4)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary">Algorithm Signal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold uppercase tracking-wider">{signal?.signal || "WAITING"}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${signal?.confluenceScore || 0}%` }} />
                  </div>
                  <span className="text-sm font-bold">{formatNumber(signal?.confluenceScore || 0, 0)}%</span>
                </div>
              </div>
              
              {signal?.reasoning && (
                <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md border border-border/50">
                  {signal.reasoning}
                </div>
              )}

              {signal?.keyFactors && signal.keyFactors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Key Factors</div>
                  <ul className="text-sm space-y-1">
                    {signal.keyFactors.map((factor, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2 text-primary">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {signal?.suggestedEntry && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                  <div>
                    <div className="text-xs text-muted-foreground">Entry</div>
                    <div className="font-bold">{formatNumber(signal.suggestedEntry, 4)}</div>
                  </div>
                  {signal.riskReward && (
                    <div>
                      <div className="text-xs text-muted-foreground">R:R</div>
                      <div className="font-bold">1:{formatNumber(signal.riskReward, 1)}</div>
                    </div>
                  )}
                  {signal.suggestedStopLoss && (
                    <div>
                      <div className="text-xs text-muted-foreground">Stop Loss</div>
                      <div className="font-bold text-destructive">{formatNumber(signal.suggestedStopLoss, 4)}</div>
                    </div>
                  )}
                  {signal.suggestedTakeProfit && (
                    <div>
                      <div className="text-xs text-muted-foreground">Take Profit</div>
                      <div className="font-bold text-green-500">{formatNumber(signal.suggestedTakeProfit, 4)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Macro Trend</div>
                  <div className={cn("text-lg font-bold uppercase tracking-wider", structure?.trend === 'bullish' ? "text-green-500" : structure?.trend === 'bearish' ? "text-destructive" : "")}>
                    {structure?.trend || "UNKNOWN"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Internal Trend</div>
                  <div className={cn("text-lg font-bold uppercase tracking-wider", structure?.internalTrend === 'bullish' ? "text-green-500" : structure?.internalTrend === 'bearish' ? "text-destructive" : "")}>
                    {structure?.internalTrend || "UNKNOWN"}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium">Recent Swing Points</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {structure?.points.slice(0, 4).map((pt, i) => (
                    <div key={i} className="bg-muted/50 p-2 rounded border border-border/50">
                      <div className="text-xs font-bold text-primary">{pt.type}</div>
                      <div className="font-mono text-sm">{formatNumber(pt.price, 4)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Supply & Demand</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {zones?.zones.map((zone) => (
                    <div key={zone.id} className={cn("p-2 rounded border", zone.type === 'supply' ? "bg-destructive/10 border-destructive/30" : "bg-green-500/10 border-green-500/30")}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn("text-xs font-bold uppercase", zone.type === 'supply' ? "text-destructive" : "text-green-500")}>
                          {zone.type}
                        </span>
                        {zone.mitigated && <Badge variant="outline" className="text-[10px]">Mitigated</Badge>}
                      </div>
                      <div className="text-sm font-mono flex justify-between">
                        <span>{formatNumber(zone.priceLow, 4)}</span>
                        <span>-</span>
                        <span>{formatNumber(zone.priceHigh, 4)}</span>
                      </div>
                    </div>
                  ))}
                  {!zones?.zones?.length && <div className="text-sm text-muted-foreground text-center py-4">No active zones</div>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {levels?.levels.map((level, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/30 border border-border/50">
                      <div>
                        <div className="font-mono text-sm">{formatNumber(level.price, 4)}</div>
                        <div className="text-xs text-muted-foreground capitalize">{level.type} • {level.touchCount} touches</div>
                      </div>
                      <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${level.strength}%` }} />
                      </div>
                    </div>
                  ))}
                  {!levels?.levels?.length && <div className="text-sm text-muted-foreground text-center py-4">No key levels detected</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
