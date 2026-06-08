import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Activity, BarChart2, BookOpen, Clock, FileText, LayoutDashboard, Settings, ShieldAlert, Target } from "lucide-react";
import { useGetWallet, getGetWalletQueryKey, useConnectWallet, useDisconnectWallet } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Positions", href: "/positions", icon: Target },
  { name: "Orders", href: "/orders", icon: Clock },
  { name: "Trades", href: "/trades", icon: FileText },
  { name: "Analysis", href: "/analysis", icon: Activity },
  { name: "Metrics", href: "/metrics", icon: BarChart2 },
  { name: "Config", href: "/config", icon: Settings },
  { name: "Risk", href: "/risk", icon: ShieldAlert },
  { name: "Logs", href: "/logs", icon: FileText },
  { name: "Whitepaper", href: "/whitepaper", icon: BookOpen },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: wallet } = useGetWallet({ query: { queryKey: getGetWalletQueryKey() } });
  const connect = useConnectWallet();
  const disconnect = useDisconnectWallet();
  const { toast } = useToast();

  const handleConnect = () => {
    connect.mutate({ data: { address: "UQ..." } }, {
      onSuccess: () => toast({ title: "Wallet connected" }),
      onError: () => toast({ title: "Connection failed", variant: "destructive" })
    });
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => toast({ title: "Wallet disconnected" })
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background dark">
        <Sidebar className="border-r border-sidebar-border/50 bg-sidebar">
          <SidebarHeader className="p-4">
            <h2 className="text-lg font-bold tracking-tight text-sidebar-primary">STORM BOT</h2>
            <p className="text-xs text-muted-foreground font-mono">TON PERPETUALS</p>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {navigation.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground"}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4 mr-2" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border/50">
            {wallet?.connected ? (
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                </div>
                <div className="text-sm font-semibold">${wallet.balanceUsd?.toFixed(2)}</div>
                <Button variant="outline" size="sm" className="w-full" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="w-full" onClick={handleConnect}>
                Connect Wallet
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
