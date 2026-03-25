import { useState, useEffect } from "react";
import {
  Shield,
  Plus,
  Trash2,
  GripVertical,
  Save,
  AlertCircle,
  RotateCcw,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FirewallRule, FirewallPolicy } from "@/types/firewall.types";
import type { IPTableRuleDTO } from "@/shared/api/client";
import { useFirewallRules, useDeleteFirewallRule, useUpdateFirewallRule, useApplyFirewall } from "../../../api/useServerHooks";

const INITIAL_POLICY: FirewallPolicy = {
  defaultInbound: "DENY",
  defaultOutbound: "ALLOW",
};

// Sortable Row Component
function SortableRuleRow({
  rule,
  index,
  onDelete,
  onToggle,
}: {
  rule: FirewallRule;
  index: number;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const { serverId } = useParams();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`
                group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors
                ${isDragging ? "bg-blue-50/50 dark:bg-blue-900/20 shadow-lg opacity-80" : ""}
                ${!rule.enabled ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/20" : ""}
            `}
    >
      <TableCell className="w-12 text-center text-zinc-400 border-r border-transparent">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <GripVertical size={16} />
        </button>
      </TableCell>
      <TableCell className="w-16 font-mono text-[11px] text-zinc-500">
        #{index + 1}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {rule.direction === "INBOUND" ? (
            <ArrowDown size={14} className="text-blue-500" />
          ) : (
            <ArrowUp size={14} className="text-purple-500" />
          )}
          <span className="font-semibold text-[13px] text-zinc-900 dark:text-zinc-100 capitalize">
            {rule.direction.toLowerCase()}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
            rule.protocol === "TCP"
              ? "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50"
              : rule.protocol === "UDP"
                ? "bg-orange-50 text-orange-700 border-orange-200/50 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50"
                : "bg-zinc-100 text-zinc-700 border-zinc-200/50 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700/50"
          }`}
        >
          {rule.protocol}
        </span>
      </TableCell>
      <TableCell className="font-mono text-[13px] font-medium text-zinc-600 dark:text-zinc-400">
        {rule.port}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
            {rule.source}
          </span>
          {rule.note && (
            <span className="text-[11px] text-zinc-500">{rule.note}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${
            rule.action === "ALLOW"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
              : rule.action === "DENY"
                ? "bg-red-50 text-red-700 border-red-200/50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
                : "bg-orange-50 text-orange-700 border-orange-200/50 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50"
          }`}
        >
          {rule.action}
        </span>
      </TableCell>
      <TableCell>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
          />
          <div className="w-8 h-4 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500 dark:peer-checked:bg-purple-600"></div>
        </label>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20"
            onClick={() => window.location.href = `/servers/${serverId}/firewall/${rule.id}/edit`}
          >
            <Shield size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
            onClick={() => onDelete(rule.id)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ServerFirewall() {
  const { serverId } = useParams<{ serverId: string }>();
  const { showNotification } = useNotification();
  
  // Real Hooks
  const { data: rulesData, isLoading: loading, refetch } = useFirewallRules(serverId || "");
  const { mutateAsync: deleteRule } = useDeleteFirewallRule(serverId || "");
  const { mutateAsync: updateRule } = useUpdateFirewallRule(serverId || "");
  const { mutateAsync: applyFirewall } = useApplyFirewall(serverId || "");

  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [originalRules, setOriginalRules] = useState<FirewallRule[]>([]);
  const [policy, setPolicy] = useState<FirewallPolicy>(INITIAL_POLICY);
  const [hasChanges, setHasChanges] = useState(false);
  const [applying, setApplying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (rulesData) {
      setRules(rulesData);
      setOriginalRules(JSON.parse(JSON.stringify(rulesData)));
    }
  }, [rulesData]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRules((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Update priorities based on new index
        const updatedPriorities = newOrder.map((rule, idx) => ({
          ...rule,
          priority: idx + 1,
        }));

        checkDiff(updatedPriorities);
        return updatedPriorities;
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule(id);
      showNotification({
        type: "success",
        message: "Firewall rule deleted",
        description: "The rule was removed from the current rule set.",
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Failed to delete rule",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  const handleToggle = async (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (rule) {
      try {
        const body: Partial<IPTableRuleDTO> = {
          enabled: !rule.enabled,
          chain: rule.direction === "OUTBOUND" ? "OUTPUT" : "INPUT",
          action: rule.action,
          protocol: rule.protocol,
          dest_port: rule.port,
          source_ip: rule.source,
          position: rule.priority,
          comment: rule.note,
        };
        await updateRule({ ruleId: rule.id, body });
        showNotification({
          type: "success",
          message: "Rule updated",
          description: `${rule.direction} ${rule.protocol} ${rule.port} is now ${!rule.enabled ? "enabled" : "disabled"}.`,
        });
      } catch (error) {
        showNotification({
          type: "error",
          message: "Failed to toggle rule",
          description: error instanceof Error ? error.message : "Request failed.",
        });
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      showNotification({
        type: "success",
        message: "Firewall rules refreshed",
        description: "Latest rules were loaded from the backend.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyChanges = async () => {
    setApplying(true);
    try {
      await applyFirewall();
      setOriginalRules(JSON.parse(JSON.stringify(rules)));
      setHasChanges(false);
      showNotification({
        type: "success",
        message: "Firewall apply queued",
        description: "The node is applying the latest iptables rules.",
      });
      await refetch();
    } catch (error) {
      showNotification({
        type: "error",
        message: "Failed to apply firewall",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setApplying(false);
    }
  };

  const checkDiff = (currentRules: FirewallRule[]) => {
    const isDiff =
      JSON.stringify(currentRules) !== JSON.stringify(originalRules);
    setHasChanges(isDiff);
  };

  const handlePolicyChange = (
    dir: "defaultInbound" | "defaultOutbound",
    val: "ALLOW" | "DENY",
  ) => {
    setPolicy((prev) => ({ ...prev, [dir]: val }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100/50 dark:border-red-500/20">
              <Shield className="text-red-500" size={20} />
            </div>
            Firewall Rules
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] tracking-widest uppercase font-bold border border-emerald-200/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50 shadow-sm ml-2">
              Active
            </span>
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
            Manage inbound and outbound traffic rules (IPtables)
          </p>
        </div>

        <Link
          to={`/servers/${serverId}/firewall/new`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-colors bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-md shadow-sm"
        >
          <Plus size={16} />
          <span>Add Rule</span>
        </Link>
        <Button variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
          <RotateCcw size={16} className={`mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Default Policy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                <ArrowDown className="text-blue-500" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-50">
                Default Inbound Policy
              </h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Action for unmatched inbound traffic
              </p>
            </div>
          </div>
          <div className="flex bg-zinc-100 dark:bg-[#1A1A1A] border border-zinc-200/50 dark:border-zinc-800/50 p-1 rounded-lg">
            {(["ALLOW", "DENY"] as const).map((action) => (
              <button
                key={action}
                onClick={() => handlePolicyChange("defaultInbound", action)}
                className={`px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider cursor-pointer font-bold transition-all ${
                  policy.defaultInbound === action
                    ? action === "ALLOW"
                      ? "bg-white dark:bg-zinc-800 shadow-sm text-emerald-600 dark:text-emerald-400 border border-zinc-200/50 dark:border-zinc-700/50"
                      : "bg-white dark:bg-zinc-800 shadow-sm text-red-600 dark:text-red-400 border border-zinc-200/50 dark:border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
                <ArrowUp className="text-purple-500" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-50">
                Default Outbound Policy
              </h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Action for unmatched outbound traffic
              </p>
            </div>
          </div>
          <div className="flex bg-zinc-100 dark:bg-[#1A1A1A] border border-zinc-200/50 dark:border-zinc-800/50 p-1 rounded-lg">
            {(["ALLOW", "DENY"] as const).map((action) => (
              <button
                key={action}
                onClick={() => handlePolicyChange("defaultOutbound", action)}
                className={`px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold transition-all ${
                  policy.defaultOutbound === action
                    ? action === "ALLOW"
                      ? "bg-white dark:bg-zinc-800 shadow-sm text-emerald-600 dark:text-emerald-400 border border-zinc-200/50 dark:border-zinc-700/50"
                      : "bg-white dark:bg-zinc-800 shadow-sm text-red-600 dark:text-red-400 border border-zinc-200/50 dark:border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center"></TableHead>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Port / Range</TableHead>
                <TableHead>Source / Dest</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-48 text-center text-zinc-500"
                  >
                     <div className="flex flex-col items-center justify-center text-sm font-medium">
                        Loading rules...
                     </div>
                  </TableCell>
                </TableRow>
              ) : (
                <SortableContext
                  items={rules.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {rules.map((rule, idx) => (
                    <SortableRuleRow
                      key={rule.id}
                      rule={rule}
                      index={idx}
                      onDelete={(id) => setDeleteCandidate(id)}
                      onToggle={handleToggle}
                    />
                  ))}
                </SortableContext>
              )}
            </TableBody>
          </Table>

          {!loading && rules.length === 0 && (
            <div className="p-12 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No rules defined. Traffic will be governed by default policy.
            </div>
          )}
        </div>
      </DndContext>

      {/* Pending Changes Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-6 z-50 animate-in slide-in-from-bottom-8 duration-500 w-[90%] md:w-[640px] border border-zinc-800 dark:border-zinc-300">
          <div className="flex items-center gap-3">
            <AlertCircle
              className="text-amber-500"
              size={20}
            />
            <div>
              <p className="font-bold text-[14px] tracking-tight">Unsaved Changes</p>
              <p className="text-[12px] opacity-70">Rules logic has changed.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRules(JSON.parse(JSON.stringify(originalRules)));
                setHasChanges(false);
              }}
              className="border-zinc-700 text-zinc-200 hover:text-white dark:border-zinc-300 dark:text-zinc-800 dark:hover:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              <RotateCcw size={14} className="mr-1.5" />
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleApplyChanges()}
              disabled={applying}
              className="bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {applying ? <RotateCcw size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
              Apply Changes
            </Button>
          </div>
        </div>
      )}
      <ConfirmActionDialog
        open={!!deleteCandidate}
        title="Delete firewall rule?"
        description="This removes the selected firewall rule from the current ruleset."
        confirmLabel="Delete Rule"
        onClose={() => setDeleteCandidate(null)}
        onConfirm={() => {
          if (!deleteCandidate) return;
          void handleDelete(deleteCandidate).finally(() => setDeleteCandidate(null));
        }}
        pending={false}
        tone="danger"
      />
    </div>
  );
}
