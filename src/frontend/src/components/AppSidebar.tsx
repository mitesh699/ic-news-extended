import { useState } from "react";
import { LayoutDashboard, Building2, Bell, Mail, Check } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useCompanies } from "@/hooks/useCompanies";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { data: companies } = useCompanies();
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (!subscribeEmail.trim()) return;
    // UI-only for now — will wire to backend
    setSubscribed(true);
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarContent className="bg-sidebar">
        {/* Brand */}
        <div className={cn(
          "px-5 pt-6 pb-4 border-b border-sidebar-border",
          collapsed && "px-2 pt-4 pb-3"
        )}>
          {collapsed ? (
            <span className="text-[14px] font-bold text-sidebar-foreground block text-center">I</span>
          ) : (
            <>
              <h2 className="text-[14px] font-bold uppercase tracking-[0.08em] text-sidebar-foreground">
                Initialized
              </h2>
              <p className="text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/40 mt-1 font-bold mono">
                Portfolio Intelligence
              </p>
            </>
          )}
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] font-bold text-sidebar-foreground/40 px-5 mono">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" end className="flex items-center gap-3 px-5 py-2.5 text-[12px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors" activeClassName="text-sidebar-foreground bg-sidebar-accent font-semibold">
                    <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                    {!collapsed && <span>News Feed</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/companies" className="flex items-center gap-3 px-5 py-2.5 text-[12px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors" activeClassName="text-sidebar-foreground bg-sidebar-accent font-semibold">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {!collapsed && <span>Companies</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Newsletter Subscribe */}
        {!collapsed && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] font-bold text-sidebar-foreground/40 px-5 flex items-center gap-2 mono">
              <Bell className="h-3 w-3" />
              Newsletter
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-5 space-y-3">
                <p className="text-[10px] text-sidebar-foreground/40 leading-[1.5]">
                  Get a summary of top news from your selected companies.
                </p>
                {/* Frequency */}
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/30 mb-1.5 mono">Frequency</p>
                  <div className="flex gap-1">
                    {(["daily", "weekly"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFrequency(f)}
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 transition-colors",
                          frequency === f
                            ? "bg-sidebar-foreground text-sidebar-background"
                            : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email + submit */}
                <div className="flex gap-1.5">
                  <input
                    type="email"
                    value={subscribeEmail}
                    onChange={e => setSubscribeEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 h-8 px-2.5 text-[11px] bg-sidebar-accent border border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30 outline-none focus:border-sidebar-foreground/30 transition-colors"
                  />
                  <button
                    onClick={handleSubscribe}
                    className={cn(
                      "h-8 px-3 text-[9px] font-bold uppercase tracking-[0.1em] transition-all shrink-0",
                      subscribed
                        ? "bg-signal-positive text-accent-foreground"
                        : "bg-accent text-accent-foreground hover:opacity-90"
                    )}
                  >
                    {subscribed ? <Check className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  </button>
                </div>
                {subscribed && (
                  <p className="text-[9px] text-signal-positive font-bold uppercase tracking-[0.1em]">
                    ✓ Subscribed!
                  </p>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar px-5 py-3">
        <div className="text-[8px] text-center uppercase tracking-[0.14em] text-sidebar-foreground/30 mono">
          Live
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
