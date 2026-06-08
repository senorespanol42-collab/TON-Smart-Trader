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
import { Activity, BarChart2, BookOpen, Clock, FileText, LayoutDashboard, Settings, ShieldAlert, Target, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useGetWallet, getGetWalletQueryKey, useDisconnectWallet } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  const { data: wallet, refetch: refetchWallet } = useGetWallet({ query: { queryKey: getGetWalletQueryKey(), refetchInterval: 15000 } });
  const disconnect = useDisconnectWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [importOpen, setImportOpen] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 24) {
      toast({ title: "Invalid seed phrase", description: `Must be exactly 24 words (got ${words.length})`, variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/wallet/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mnemonic: mnemonic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      setMnemonic("");
      setImportOpen(false);
      await queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      await refetchWallet();
      toast({ title: "Wallet imported", description: `Address: ${data.address?.slice(0, 10)}...` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        toast({ title: "Wallet disconnected" });
      },
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
                <div className="text-xs font-mono text-green-400 truncate">
                  ● {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-6)}
                </div>
                {wallet.balance != null && (
                  <div className="text-sm font-semibold text-muted-foreground">
                    {wallet.balance.toFixed(4)} TON
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="w-full" onClick={() => setImportOpen(true)}>
                Import Wallet
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

      {/* Seed Phrase Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setMnemonic(""); setShowMnemonic(false); } }}>
        <DialogContent className="sm:max-w-lg dark bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Import TON Wallet</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your 24-word mnemonic seed phrase. It is encrypted and stored securely on this server.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-md border border-yellow-600/40 bg-yellow-950/20 p-3 text-xs text-yellow-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Never share your seed phrase with anyone. This bot will use it to sign real transactions that spend real money.
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mnemonic" className="text-foreground text-sm">24-Word Seed Phrase</Label>
              <div className="relative">
                <Textarea
                  id="mnemonic"
                  value={showMnemonic ? mnemonic : mnemonic.replace(/\S/g, "•")}
                  onChange={(e) => {
                    if (showMnemonic) setMnemonic(e.target.value);
                  }}
                  onFocus={() => setShowMnemonic(true)}
                  placeholder="word1 word2 word3 ... word24"
                  className="font-mono text-sm bg-background border-border text-foreground resize-none min-h-[100px] pr-10"
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                />
                <button
                  type="button"
                  onClick={() => setShowMnemonic((v) => !v)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {mnemonic.trim() ? `${mnemonic.trim().split(/\s+/).length} / 24 words` : "Paste your seed phrase above"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleImport}
                disabled={importing || mnemonic.trim().split(/\s+/).length !== 24}
              >
                {importing ? "Importing..." : "Import & Connect"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
