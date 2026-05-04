import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth";
import DashboardLayout from "./components/DashboardLayout";
import Connection from "./pages/Connection";
import Chats from "./pages/Chats";
import Broadcasts from "./pages/Broadcasts";
import AutoReplies from "./pages/AutoReplies";
import AISettings from "./pages/AISettings";
import Activity from "./pages/Activity";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<DashboardLayout />}>
              <Route path="/connection" element={<Connection />} />
              <Route path="/chats" element={<Chats />} />
              <Route path="/broadcasts" element={<Broadcasts />} />
              <Route path="/auto-replies" element={<AutoReplies />} />
              <Route path="/ai" element={<AISettings />} />
              <Route path="/activity" element={<Activity />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Toaster>
    </BrowserRouter>
  </TooltipProvider>
  </QueryClientProvider>
);

export default App;
