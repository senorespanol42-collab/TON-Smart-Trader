import { useEffect, useRef } from "react";
import { useGetRiskLimits, getGetRiskLimitsQueryKey, useUpdateRiskLimits } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  maxDailyLossUsd: z.coerce.number().min(0),
  maxPositionSizeUsd: z.coerce.number().min(0),
  maxOpenPositions: z.coerce.number().min(1).max(20),
  maxLeverage: z.coerce.number().min(1).max(100),
  stopLossPercent: z.coerce.number().min(0.1).max(100),
  takeProfitPercent: z.coerce.number().min(0.1).max(500),
  maxDrawdownPercent: z.coerce.number().min(1).max(100),
  enabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Risk() {
  const { data: limits, isLoading } = useGetRiskLimits({ query: { queryKey: getGetRiskLimitsQueryKey() } });
  const updateLimits = useUpdateRiskLimits();
  const { toast } = useToast();
  const initialized = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      maxDailyLossUsd: 100,
      maxPositionSizeUsd: 500,
      maxOpenPositions: 3,
      maxLeverage: 10,
      stopLossPercent: 2,
      takeProfitPercent: 6,
      maxDrawdownPercent: 10,
      enabled: true,
    }
  });

  useEffect(() => {
    if (limits && !initialized.current) {
      form.reset({
        maxDailyLossUsd: limits.maxDailyLossUsd,
        maxPositionSizeUsd: limits.maxPositionSizeUsd,
        maxOpenPositions: limits.maxOpenPositions,
        maxLeverage: limits.maxLeverage,
        stopLossPercent: limits.stopLossPercent,
        takeProfitPercent: limits.takeProfitPercent,
        maxDrawdownPercent: limits.maxDrawdownPercent,
        enabled: limits.enabled,
      });
      initialized.current = true;
    }
  }, [limits, form]);

  const onSubmit = (data: FormValues) => {
    updateLimits.mutate({ data }, {
      onSuccess: () => toast({ title: "Risk limits updated successfully" }),
      onError: () => toast({ title: "Failed to update risk limits", variant: "destructive" })
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground text-center">Loading risk limits...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Risk Management</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-destructive/30 shadow-sm shadow-destructive/10">
            <CardHeader className="bg-destructive/5 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-destructive">Hard Limits Enforcement</CardTitle>
                  <CardDescription>If enabled, bot will halt trading when limits are reached</CardDescription>
                </div>
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="maxDailyLossUsd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Daily Loss (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="maxDrawdownPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Portfolio Drawdown (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxLeverage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Leverage (x)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="maxPositionSizeUsd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Position Size (USD)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxOpenPositions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Concurrent Positions</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="stopLossPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default SL (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="takeProfitPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default TP (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={updateLimits.isPending} className="w-full">
            Save Risk Limits
          </Button>
        </form>
      </Form>
    </div>
  );
}
