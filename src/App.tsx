import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import SalesDashboard from "./pages/SalesDashboard";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import TeamSettings from "./pages/TeamSettings";
import TeamHub from "./pages/TeamHub";
import ClientAssets from "./pages/ClientAssets";
import OnboardingForm from "./pages/OnboardingForm";
import NotFound from "./pages/NotFound";
import FunnelList from "./pages/FunnelList";
import FunnelEditor from "./pages/FunnelEditor";
import PublicFunnel from "./pages/PublicFunnel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes - no auth required */}
            <Route path="/onboard/:token" element={<OnboardingForm />} />
            <Route path="/f/:slug" element={<PublicFunnel />} />
            
            {/* Authenticated routes */}
            <Route path="/" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/confirm" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/client-assets" element={<ClientAssets />} />
            <Route path="/team/:teamId" element={<TeamHub />} />
            <Route path="/team/:teamId/assets" element={<TeamHub />} />
            <Route path="/team/:teamId/chat" element={<TeamHub />} />
            <Route path="/team/:teamId/funnels" element={<FunnelList />} />
            <Route path="/team/:teamId/funnels/:funnelId" element={<FunnelEditor />} />
            <Route path="/team/:teamId/sales" element={<SalesDashboard />} />
            <Route path="/team/:teamId/settings" element={<TeamSettings />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
