"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type NotificationType = "success" | "error" | "info" | "warning";

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, "id">) => void;
  hideNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback((n: Omit<Notification, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { ...n, id }]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, showNotification, hideNotification }}
    >
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-[340px] pointer-events-none">
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onClose={() => hideNotification(n.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

function NotificationItem({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const duration = notification.duration || 5000;
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300); // Wait for exit animation
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleManualClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  const variants = {
    success: {
      icon: CheckCircle2,
      iconClass: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    error: {
      icon: AlertCircle,
      iconClass: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-50 dark:bg-red-500/10",
    },
    warning: {
      icon: AlertTriangle,
      iconClass: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-500/10",
    },
    info: {
      icon: Info,
      iconClass: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-500/10",
    },
  };

  const config = variants[notification.type] || variants.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "pointer-events-auto relative overflow-hidden p-4 rounded-xl border shadow-xl shadow-zinc-900/5 bg-white dark:bg-[#121212] flex gap-3.5 items-start",
        "border-zinc-200 dark:border-zinc-800 transition-all duration-300",
        isLeaving
          ? "opacity-0 translate-x-8"
          : "animate-in fade-in slide-in-from-right-8",
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", config.iconBg)}>
        <Icon size={16} className={config.iconClass} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-none mb-1.5 pt-1 truncate">
          {notification.message}
        </p>
        {notification.description && (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-snug">
            {notification.description}
          </p>
        )}
      </div>

      <button
        onClick={handleManualClose}
        className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors bg-transparent border-none outline-none mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
}
