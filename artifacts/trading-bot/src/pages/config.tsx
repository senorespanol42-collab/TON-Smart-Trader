import { useEffect, useRef } from "react";
import { useGetConfig, getGetConfigQueryKey, useUpdateConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  pair: z.string().min(1),
  interval: z.string(),
  strategy: z.string(),
  smcEnabled: z.boolean(),
  priceActionEnabled: z.boolean(),
  volumeFilter: z.boolean(),
  sessionFilter: z.boolean(),
  entryFilters: z.object({
    minConfluenceScore: z.coerce.number().min(0).max(100),
    requireBos: z.boolean(),
    requireChoch: z.boolean(),
    requireFvg: z.boolean(),
    requireOrderBlock: z.boolean(),
    minRiskReward: z.coerce.number().min(0),
  }),
  exitRules: z.object({
    trailingStop: z.boolean(),
    partialTakeProfit: z.boolean(),
    trailingStopActivationPercent: z.coerce.number().min(0),
    partialTakeProfitPercent: z.coerce.number().min(0),
  })
});

type FormValues = z.infer<typeof formSchema>;

export default function Config() {
  const { data: config, isLoading } = useGetConfig({ query: { queryKey: getGetConfigQueryKey() } });
  const updateConfig = useUpdateConfig();
  const { toast } = useToast();
  const initialized = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pair: "TON/USDT",
      interval: "15m",
      strategy: "moderate",
      smcEnabled: true,
      priceActionEnabled: true,
      volumeFilter: true,
      sessionFilter: false,
      entryFilters: {
        minConfluenceScore: 70,
        requireBos: true,
        requireChoch: false,
        requireFvg: false,
        requireOrderBlock: true,
        minRiskReward: 1.5,
      },
      exitRules: {
        trailingStop: true,
        partialTakeProfit: true,
        trailingStopActivationPercent: 1.5,
        partialTakeProfitPercent: 1.0,
      }
    }
  });

  useEffect(() => {
    if (config && !initialized.current) {
      form.reset({
        pair: config.pair,
        interval: config.interval,
        strategy: config.strategy,
        smcEnabled: config.smcEnabled,
        priceActionEnabled: config.priceActionEnabled,
        volumeFilter: config.volumeFilter,
        sessionFilter: config.sessionFilter,
        entryFilters: config.entryFilters,
        exitRules: config.exitRules,
      });
      initialized.current = true;
    }
  }, [config, form]);

  const onSubmit = (data: FormValues) => {
    updateConfig.mutate({ data }, {
      onSuccess: () => toast({ title: "Configuration updated successfully" }),
      onError: () => toast({ title: "Failed to update configuration", variant: "destructive" })
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground text-center">Loading configuration...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Strategy Configuration</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Core trading parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="pair"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trading Pair</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeframe</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1m">1m</SelectItem>
                          <SelectItem value="5m">5m</SelectItem>
                          <SelectItem value="15m">15m</SelectItem>
                          <SelectItem value="1h">1h</SelectItem>
                          <SelectItem value="4h">4h</SelectItem>
                          <SelectItem value="1d">1d</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="strategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy Profile</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select strategy" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="conservative">Conservative</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="aggressive">Aggressive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Algorithm Layers</CardTitle>
                <CardDescription>Toggle specific analysis engines</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="smcEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Smart Money Concepts</FormLabel>
                        <FormDescription>Enable supply/demand, order blocks, FVG</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceActionEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Price Action</FormLabel>
                        <FormDescription>Key levels, market structure breaks</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="volumeFilter"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Volume Confirmation</FormLabel>
                        <FormDescription>Require supporting volume on entry</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Entry Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="entryFilters.minConfluenceScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Confluence Score (0-100)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="entryFilters.minRiskReward"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Risk:Reward Ratio</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3 pt-2">
                  <FormField
                    control={form.control}
                    name="entryFilters.requireBos"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Require Break of Structure (BOS)</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="entryFilters.requireChoch"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Require Change of Character (CHoCH)</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="entryFilters.requireFvg"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Require Fair Value Gap (FVG)</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="entryFilters.requireOrderBlock"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Require Order Block alignment</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exit Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="exitRules.trailingStop"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Trailing Stop</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("exitRules.trailingStop") && (
                  <FormField
                    control={form.control}
                    name="exitRules.trailingStopActivationPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activation %</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="exitRules.partialTakeProfit"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Partial Take Profit (50%)</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("exitRules.partialTakeProfit") && (
                  <FormField
                    control={form.control}
                    name="exitRules.partialTakeProfitPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target %</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Button type="submit" disabled={updateConfig.isPending} className="w-full">
            Save Configuration
          </Button>
        </form>
      </Form>
    </div>
  );
}
