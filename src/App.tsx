import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import SalesDashboard from "./pages/SalesDashboard";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import TeamSettings from "./pages/TeamSettings";
import ClientAssets from "./pages/ClientAssets";
import OnboardingForm from "./pages/OnboardingForm";
import NotFound from "./pages/NotFound";
import FunnelList from "./pages/FunnelList";
import FunnelEditor from "./pages/FunnelEditor";
import PublicFunnel from "./pages/PublicFunnel";
import { TeamLayout } from "./layouts/TeamLayout";
import { TeamHubOverview } from "./pages/TeamHubOverview";
import { TeamChatPage } from "./pages/TeamChat";
import { IntegrationsPortal } from "./components/IntegrationsPortal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
            
            {/* Auth routes */}
            <Route path="/" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/confirm" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/client-assets" element={<ClientAssets />} />
            
            {/* Team routes with sidebar layout */}
            <Route path="/team/:teamId" element={<TeamLayout />}>
              <Route index element={<TeamHubOverview />} />
              <Route path="crm" element={<SalesDashboard />} />
              <Route path="funnels" element={<FunnelList />} />
              <Route path="funnels/:funnelId" element={<FunnelEditor />} />
              <Route path="chat" element={<TeamChatPage />} />
              <Route path="integrations" element={<IntegrationsPortal />} />
              <Route path="settings" element={<TeamSettings />} />
            </Route>
            
            {/* Legacy routes - redirect to new structure */}
            <Route path="/team/:teamId/sales" element={<Navigate to="../crm" replace />} />
            <Route path="/team/:teamId/assets" element={<Navigate to=".." replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
