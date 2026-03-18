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
import AppRoutes from "@/routes/AppRoutes";

function AppContent() {
  const location = useLocation();
  const isPublicRoute = location.pathname === "/diagram";

  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setTimeout(() => {
      showNotification({
        type: "success",
        message: "Welcome back, Admin!",
        description:
          "You have successfully connected to the EINFRA secure cluster.",
      });
    }, 100);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isAppLoading && !isPublicRoute) {
    return <LoadingPage />;
  }

  if (!isAuthenticated && !isPublicRoute) {
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
