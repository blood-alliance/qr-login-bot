import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  MessageCircle,
  QrCode,
  Send,
  Sparkles,
  Bot,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/connection", label: "Connection", icon: QrCode },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/broadcasts", label: "Broadcasts", icon: Send },
  { to: "/auto-replies", label: "Auto-replies", icon: Bot },
  { to: "/ai", label: "AI Assistant", icon: Sparkles },
  { to: "/activity", label: "Activity", icon: Activity },
];

export default function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex bg-[image:var(--gradient-subtle)]">
      <aside className="w-64 border-r bg-sidebar/80 backdrop-blur-sm flex flex-col">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center text-primary-foreground shadow-[var(--shadow-elegant)]">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <div className="font-semibold leading-tight">WA Bot</div>
              <div className="text-xs text-muted-foreground">Dashboard</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )
              }
            >
              <n.icon className="size-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="text-xs text-muted-foreground truncate px-1">{user.email}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
