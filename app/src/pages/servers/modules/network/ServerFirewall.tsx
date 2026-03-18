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
import { mockFirewallService } from "../shared/mockFirewallService";

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
    <tr
      ref={setNodeRef}
      style={style}
      className={`
                group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors
                ${isDragging ? "bg-blue-50 dark:bg-blue-900/20 shadow-lg opacity-80" : ""}
                ${!rule.enabled ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/50" : ""}
            `}
    >
      <td className="px-4 py-4 w-12 text-center text-zinc-400">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <GripVertical size={16} />
        </button>
      </td>
      <td className="px-6 py-4 font-mono text-xs text-zinc-400">
        #{index + 1}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {rule.direction === "INBOUND" ? (
            <ArrowDown size={14} className="text-blue-500" />
          ) : (
            <ArrowUp size={14} className="text-purple-500" />
          )}
          <span className="font-bold text-sm text-zinc-900 dark:text-white capitalize">
            {rule.direction.toLowerCase()}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <span
          className={`px-2 py-0.5 rounded text-xs border ${
            rule.protocol === "TCP"
              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
              : rule.protocol === "UDP"
                ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
                : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
          }`}
        >
          {rule.protocol}
        </span>
      </td>
      <td className="px-6 py-4 font-mono text-sm text-zinc-600 dark:text-zinc-400">
        {rule.port}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
            {rule.source}
          </span>
          {rule.note && (
            <span className="text-xs text-zinc-400 italic">{rule.note}</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
            rule.action === "ALLOW"
              ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
              : rule.action === "DENY"
                ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                : "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"
          }`}
        >
          {rule.action}
        </span>
      </td>
      <td className="px-6 py-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
          />
          <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={`${rule.id}/edit`}
            className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Shield size={16} />
          </Link>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ServerFirewall() {
  const { serverId } = useParams<{ serverId: string }>();
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [originalRules, setOriginalRules] = useState<FirewallRule[]>([]);
  const [policy, setPolicy] = useState<FirewallPolicy>(INITIAL_POLICY);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    const data = await mockFirewallService.getRules();
    setRules(data);
    setOriginalRules(JSON.parse(JSON.stringify(data)));
    setLoading(false);
  };

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
    if (confirm("Are you sure you want to delete this rule?")) {
      await mockFirewallService.deleteRule(id);
      loadRules(); // Reload
    }
  };

  const handleToggle = async (id: string) => {
    // Optimistic
    const newRules = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    setRules(newRules);

    const rule = newRules.find((r) => r.id === id);
    if (rule) {
      await mockFirewallService.saveRule(rule);
      setOriginalRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: rule.enabled } : r)),
      );
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
    setHasChanges(true); // Assuming policy change also needs apply
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            Firewall Rules
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
              Active
            </span>
          </h2>
          <p className="text-sm text-zinc-500">
            Manage inbound and outbound traffic rules (IPtables)
          </p>
        </div>

        <Link
          to={`/servers/${serverId}/firewall/new`}
          className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={16} />
          <span>Add Rule</span>
        </Link>
      </div>

      {/* Default Policy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <ArrowDown className="text-blue-500" size={20} />
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                Default Inbound Policy
              </h3>
              <p className="text-xs text-zinc-500">
                Action for unmatched inbound traffic
              </p>
            </div>
          </div>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-sm">
            {(["ALLOW", "DENY"] as const).map((action) => (
              <button
                key={action}
                onClick={() => handlePolicyChange("defaultInbound", action)}
                className={`px-3 py-1 rounded-sm text-xs cursor-pointer font-bold transition-all ${
                  policy.defaultInbound === action
                    ? action === "ALLOW"
                      ? "bg-white shadow text-green-600 "
                      : "bg-white shadow text-red-600"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <ArrowUp className="text-purple-500" size={20} />
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                Default Outbound Policy
              </h3>
              <p className="text-xs text-zinc-500">
                Action for unmatched outbound traffic
              </p>
            </div>
          </div>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-sm">
            {(["ALLOW", "DENY"] as const).map((action) => (
              <button
                key={action}
                onClick={() => handlePolicyChange("defaultOutbound", action)}
                className={`px-3 py-1 rounded-sm text-xs font-bold transition-all ${
                  policy.defaultOutbound === action
                    ? action === "ALLOW"
                      ? "bg-white shadow text-green-600 "
                      : "bg-white shadow text-red-600"
                    : "text-zinc-500 hover:text-zinc-700"
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/30 dark:bg-zinc-800/10 text-zinc-500 text-xs uppercase font-bold tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-4 w-12 text-center"></th>
                <th className="px-6 py-4 w-16">#</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Protocol</th>
                <th className="px-6 py-4">Port / Range</th>
                <th className="px-6 py-4">Source / Dest</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Enabled</th>
                <th className="px-6 py-4 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-zinc-500"
                  >
                    Loading rules...
                  </td>
                </tr>
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
                      onDelete={handleDelete}
                      onToggle={handleToggle}
                    />
                  ))}
                </SortableContext>
              )}
            </tbody>
          </table>

          {!loading && rules.length === 0 && (
            <div className="p-12 text-center text-zinc-500">
              No rules defined. Traffic will be governed by default policy.
            </div>
          )}
        </div>
      </DndContext>

      {/* Pending Changes Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 dark:bg-white/90 backdrop-blur text-white dark:text-zinc-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-50 border border-white/10 dark:border-zinc-200 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <AlertCircle
              className="text-yellow-400 dark:text-orange-500"
              size={20}
            />
            <div>
              <p className="font-bold text-sm">Unsaved Changes</p>
              <p className="text-xs opacity-70">Rules logic has changed.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRules(JSON.parse(JSON.stringify(originalRules)));
                setHasChanges(false);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/20 dark:hover:bg-zinc-200/50 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              onClick={async () => {
                await mockFirewallService.updateRulesOrder(rules);
                setOriginalRules(JSON.parse(JSON.stringify(rules)));
                setHasChanges(false);
              }}
              className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
            >
              <Save size={14} />
              Apply Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
