import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  activeTab: string
  setActiveTab: (value: string) => void
} | null>(null)

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internalTab, setInternalTab] = React.useState(defaultValue || "")
  const activeTab = value !== undefined ? value : internalTab

  const handleTabChange = (newValue: string) => {
    if (value === undefined) {
      setInternalTab(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={cn("w-full", className)} data-state={activeTab}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <nav 
        className={cn("-mb-px flex space-x-6 overflow-x-auto custom-scrollbar no-scrollbar-buttons", className)} 
        role="tablist" 
        aria-orientation="horizontal"
      >
        {children}
      </nav>
    </div>
  )
}

export function TabsTrigger({ 
  value, 
  className, 
  children,
  icon: Icon
}: { 
  value: string; 
  className?: string; 
  children: React.ReactNode;
  icon?: any;
}) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsTrigger must be used within Tabs")
  
  const isActive = context.activeTab === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => context.setActiveTab(value)}
      className={cn(
        "whitespace-nowrap py-3 px-2 border-b-2 font-semibold text-[13px] flex items-center gap-2 cursor-pointer transition-colors outline-none shrink-0",
        isActive
          ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700",
        className
      )}
    >
      {Icon && <Icon size={16} className={isActive ? "opacity-100" : "opacity-70"} />}
      {children}
    </button>
  )
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsContent must be used within Tabs")
  
  if (context.activeTab !== value) return null
  
  return (
    <div
      role="tabpanel"
      className={cn("mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 focus-visible:outline-none", className)}
    >
      {children}
    </div>
  )
}
