import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { 
  Home, 
  TrendingUp, 
  Layers, 
  MessageCircle, 
  Plug, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TeamSidebarProps {
  teamName: string;
  teamLogo?: string | null;
}

const navItems = [
  { id: "home", label: "Team Hub", icon: Home, path: "" },
  { id: "crm", label: "Sales CRM", icon: TrendingUp, path: "/crm" },
  { id: "funnels", label: "Funnels", icon: Layers, path: "/funnels" },
  { id: "chat", label: "Team Chat", icon: MessageCircle, path: "/chat" },
  { id: "integrations", label: "Integrations", icon: Plug, path: "/integrations" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
];

export function TeamSidebar({ teamName, teamLogo }: TeamSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { teamId } = useParams();
  
  const basePath = `/team/${teamId}`;
  
  const isActive = (path: string) => {
    const fullPath = `${basePath}${path}`;
    if (path === "") {
      return location.pathname === basePath || location.pathname === `${basePath}/`;
    }
    return location.pathname.startsWith(fullPath);
  };

  const handleNavigation = (path: string) => {
    navigate(`${basePath}${path}`);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Team Header */}
      <div className={cn(
        "p-4 border-b border-sidebar-border flex items-center gap-3",
        collapsed && "justify-center"
      )}>
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={teamLogo || undefined} alt={teamName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
            {getInitials(teamName)}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sidebar-foreground truncate">{teamName}</h2>
            <p className="text-xs text-sidebar-foreground/60">Team Workspace</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const NavButton = (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-11 transition-all",
                collapsed && "justify-center px-0",
                active 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              onClick={() => handleNavigation(item.path)}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </Button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  {NavButton}
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return NavButton;
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-11 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
            collapsed && "justify-center px-0"
          )}
          onClick={() => navigate("/")}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Exit Team</span>}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "w-full h-9 text-sidebar-foreground/50 hover:text-sidebar-foreground",
            collapsed && "justify-center"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
