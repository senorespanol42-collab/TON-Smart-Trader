import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Positions from "@/pages/positions";
import Orders from "@/pages/orders";
import Trades from "@/pages/trades";
import Analysis from "@/pages/analysis";
import Metrics from "@/pages/metrics";
import Config from "@/pages/config";
import Risk from "@/pages/risk";
import Logs from "@/pages/logs";
import Whitepaper from "@/pages/whitepaper";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/positions" component={Positions} />
        <Route path="/orders" component={Orders} />
        <Route path="/trades" component={Trades} />
        <Route path="/analysis" component={Analysis} />
        <Route path="/metrics" component={Metrics} />
        <Route path="/config" component={Config} />
        <Route path="/risk" component={Risk} />
        <Route path="/logs" component={Logs} />
        <Route path="/whitepaper" component={Whitepaper} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
