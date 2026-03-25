import { useState, useEffect } from "react";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/core/ThemeContext";
import {
  NotificationProvider,
  useNotification,
} from "@/core/NotificationContext";
import Layout from "@/components/Layout";
import Topbar from "@/components/Topbar";
import LoadingPage from "@/pages/LoadingPage";
import { LoginPage } from "@/features/authentication";
import {
  clearSession,
  getStoredSession,
  saveSession,
  type AuthSession,
} from "@/features/authentication/auth-session";
import { fetchMe } from "@/features/authentication/api";
import AppRoutes from "@/routes/AppRoutes";

function AppContent() {
  const location = useLocation();
  const isPublicRoute = location.pathname === "/diagram";

  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const { showNotification } = useNotification();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const current = getStoredSession();
      if (!current) {
        if (!cancelled) {
          setIsAppLoading(false);
        }
        return;
      }
      try {
        const me = await fetchMe(current.accessToken);
        if (!cancelled && me.user && me.principal) {
          const nextSession: AuthSession = {
            ...current,
            user: me.user,
            principal: me.principal,
            organizations: me.organizations ?? current.organizations,
          };
          saveSession(nextSession);
          setSession(nextSession);
        }
      } catch {
        clearSession();
      } finally {
        if (!cancelled) {
          setIsAppLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (nextSession: AuthSession) => {
    setIsAuthTransitioning(true);
    setSession(nextSession);
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    showNotification({
      type: "success",
      message: "Welcome back",
      description: `You are connected to ${nextSession.organizations[0]?.name ?? "your"} workspace.`,
    });
    setIsAuthTransitioning(false);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  if ((isAppLoading || isAuthTransitioning) && !isPublicRoute) {
    return <LoadingPage />;
  }

  if (!session && !isPublicRoute) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Layout>
      <div className="flex flex-col h-full bg-background transition-colors duration-500">
        <PageHeader onLogout={handleLogout} />
        <main className="flex-1 px-6 pt-6 overflow-y-auto custom-scrollbar">
          <div className="mx-auto">
            <AppRoutes />
          </div>
        </main>
      </div>
    </Layout>
  );
}

function PageHeader({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();

  const getPageTitle = (path: string) => {
    const routeTitles: Record<string, string> = {
      "/": "Dashboard Overview",
      "/environments": "Environments",
      "/users": "User Management",
      "/roles": "Role Assignments",
      "/networks": "Network Infrastructure",
      "/registries": "Container Registries",
      "/events": "Activity Audit Logs",
      "/profile": "My Settings",
    };
    return routeTitles[path] || "Dashboard";
  };

  return (
    <Topbar currentPage={getPageTitle(location.pathname)} onLogout={onLogout} />
  );
}

import { EnvironmentProvider } from "@/core/EnvironmentContext";

function App() {
  return (
    <ThemeProvider>
      <EnvironmentProvider>
        <NotificationProvider>
          <Router>
            <AppContent />
          </Router>
        </NotificationProvider>
      </EnvironmentProvider>
    </ThemeProvider>
  );
}

export default App;
