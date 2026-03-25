"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Plus, Save, Trash2, Workflow } from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import {
  notificationRoutingApi,
  type NotificationRoutingRule,
  type NotificationRoutingSimulationResponse,
} from "@/features/notifications/api";
import { tagsApi } from "@/features/catalog/api";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";

const PROVIDERS = ["telegram", "whatsapp", "github-actions", "gitlab-cicd"] as const;
const EVENT_TYPES = ["alert", "security", "system", "user"];
const PRIORITIES = ["high", "medium", "low"];
const CHANNELS = ["in-app", "email", "telegram", "whatsapp"];
const STATUSES = ["open", "resolved"];

type SimulationDraft = {
  title: string;
  description: string;
  type: string;
  channel: string;
  priority: string;
  status: string;
  tags: string;
  metadata: string;
};

const emptyRule = (): Partial<NotificationRoutingRule> => ({
  name: "",
  description: "",
  enabled: true,
  integration_kind: "telegram",
  event_types: [],
  priorities: [],
  channels: [],
  statuses: [],
  tags: [],
  tag_prefixes: [],
  metadata: {},
});

const defaultSimulationDraft = (): SimulationDraft => ({
  title: "Production memory alert",
  description: "Container memory usage is above 90% on payments-api.",
  type: "alert",
  channel: "telegram",
  priority: "high",
  status: "open",
  tags: "env:prod, app:payments, service:payments-api",
  metadata: JSON.stringify({
    source: "dashboard-simulator",
    "einfra.tag.team": "platform",
  }, null, 2),
});

export default function NotificationRoutingRulesPage() {
  const { showNotification } = useNotification();
  const [rules, setRules] = useState<NotificationRoutingRule[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<NotificationRoutingRule>>(emptyRule());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [simulationDraft, setSimulationDraft] = useState<SimulationDraft>(defaultSimulationDraft());
  const [simulationResult, setSimulationResult] = useState<NotificationRoutingSimulationResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const selectedRule = useMemo(
    () => rules.find((item) => item.id === selectedId) ?? null,
    [rules, selectedId],
  );

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [routingRules, tags] = await Promise.all([
        notificationRoutingApi.list(),
        tagsApi.list(),
      ]);
      setRules(routingRules);
      setAvailableTags(tags.map((item) => item.name));
      if (routingRules.length > 0) {
        setSelectedId((current) => current ?? routingRules[0].id);
        setDraft(routingRules[0]);
      } else {
        setSelectedId(null);
        setDraft(emptyRule());
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load routing rules",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectRule = (rule: NotificationRoutingRule) => {
    setSelectedId(rule.id);
    setDraft(rule);
  };

  const updateDraft = (patch: Partial<NotificationRoutingRule>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const toggleListValue = (key: "event_types" | "priorities" | "channels" | "statuses" | "tags" | "tag_prefixes", value: string) => {
    const current = Array.isArray(draft[key]) ? (draft[key] as string[]) : [];
    updateDraft({
      [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    });
  };

  const saveRule = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        name: draft.name?.trim(),
        description: draft.description?.trim(),
      };
      const saved = selectedRule?.id
        ? await notificationRoutingApi.update(selectedRule.id, payload)
        : await notificationRoutingApi.create(payload);
      showNotification({ type: "success", message: "Routing rule saved" });
      await loadAll();
      setSelectedId(saved.id);
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save routing rule",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!selectedRule) return;
    setIsSaving(true);
    try {
      await notificationRoutingApi.remove(selectedRule.id);
      showNotification({ type: "success", message: "Routing rule deleted" });
      await loadAll();
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to delete routing rule",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      const metadata = simulationDraft.metadata.trim()
        ? JSON.parse(simulationDraft.metadata)
        : {};
      const result = await notificationRoutingApi.simulate({
        title: simulationDraft.title,
        description: simulationDraft.description,
        type: simulationDraft.type,
        channel: simulationDraft.channel,
        priority: simulationDraft.priority,
        status: simulationDraft.status,
        tags: simulationDraft.tags.split(",").map((item) => item.trim()).filter(Boolean),
        metadata,
      });
      setSimulationResult(result);
      showNotification({ type: "success", message: "Routing simulation completed" });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to run routing simulation",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Workflow className="h-6 w-6 text-indigo-500" />
            Notification Routing Rules
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Route notifications to specific providers by event type, priority, channel, tags, and tag prefixes.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSelectedId(null);
            setDraft(emptyRule());
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Rule Inventory</div>
            <Badge variant="outline">{rules.length} rules</Badge>
          </div>
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">Loading routing rules...</div>
          ) : rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
              No routing rules yet. Create one to override provider delivery behavior.
            </div>
          ) : (
            rules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => selectRule(rule)}
                className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${selectedId === rule.id ? "border-indigo-500 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10" : "border-zinc-200 dark:border-zinc-800"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{rule.name}</div>
                  <Badge variant={rule.enabled ? "success" : "outline"}>{rule.enabled ? "enabled" : "disabled"}</Badge>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{rule.integration_kind}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(rule.tags ?? []).slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="grid gap-4 md:grid-cols-2">
            <Input value={draft.name ?? ""} onChange={(e) => updateDraft({ name: e.target.value })} placeholder="Production Telegram Alerts" />
            <select
              value={draft.integration_kind ?? "telegram"}
              onChange={(e) => updateDraft({ integration_kind: e.target.value })}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
            >
              {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
            <Input value={draft.description ?? ""} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="Critical production notifications to Telegram" className="md:col-span-2" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <RulePicker title="Event Types" values={EVENT_TYPES} selected={draft.event_types ?? []} onToggle={(value) => toggleListValue("event_types", value)} />
            <RulePicker title="Priorities" values={PRIORITIES} selected={draft.priorities ?? []} onToggle={(value) => toggleListValue("priorities", value)} />
            <RulePicker title="Channels" values={CHANNELS} selected={draft.channels ?? []} onToggle={(value) => toggleListValue("channels", value)} />
            <RulePicker title="Statuses" values={STATUSES} selected={draft.statuses ?? []} onToggle={(value) => toggleListValue("statuses", value)} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <RulePicker title="Exact Tags" values={availableTags} selected={draft.tags ?? []} onToggle={(value) => toggleListValue("tags", value)} />
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-3 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-indigo-500" />
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tag Prefixes</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["app:", "team:", "service:", "env:", "stack:"].map((prefix) => {
                  const selected = (draft.tag_prefixes ?? []).includes(prefix);
                  return (
                    <button
                      key={prefix}
                      type="button"
                      onClick={() => toggleListValue("tag_prefixes", prefix)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${selected ? "border-indigo-500 bg-indigo-500 text-white" : "border-zinc-200 dark:border-zinc-700"}`}
                    >
                      {prefix}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <div className="text-sm font-medium">Rule Enabled</div>
              <div className="text-xs text-zinc-500">Disabled rules stay saved but do not participate in delivery routing.</div>
            </div>
            <input
              type="checkbox"
              checked={draft.enabled ?? true}
              onChange={(e) => updateDraft({ enabled: e.target.checked })}
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            {selectedRule ? (
              <Button variant="outline" onClick={() => void deleteRule()} isLoading={isSaving}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => void saveRule()} isLoading={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              Save Rule
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Routing Simulation</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Test a sample notification and inspect exactly which rules match and which providers would receive it.
              </p>
            </div>
            <Badge variant="outline">Pre-flight</Badge>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input value={simulationDraft.title} onChange={(e) => setSimulationDraft((current) => ({ ...current, title: e.target.value }))} placeholder="Notification title" />
            <select
              value={simulationDraft.type}
              onChange={(e) => setSimulationDraft((current) => ({ ...current, type: e.target.value }))}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
            >
              {EVENT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <Input value={simulationDraft.description} onChange={(e) => setSimulationDraft((current) => ({ ...current, description: e.target.value }))} placeholder="Notification description" className="md:col-span-2" />
            <select
              value={simulationDraft.channel}
              onChange={(e) => setSimulationDraft((current) => ({ ...current, channel: e.target.value }))}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
            >
              {CHANNELS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select
              value={simulationDraft.priority}
              onChange={(e) => setSimulationDraft((current) => ({ ...current, priority: e.target.value }))}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
            >
              {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select
              value={simulationDraft.status}
              onChange={(e) => setSimulationDraft((current) => ({ ...current, status: e.target.value }))}
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
            >
              {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <Input value={simulationDraft.tags} onChange={(e) => setSimulationDraft((current) => ({ ...current, tags: e.target.value }))} placeholder="env:prod, app:payments, team:platform" className="md:col-span-2" />
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Metadata JSON</div>
            <textarea
              value={simulationDraft.metadata}
              onChange={(e) => setSimulationDraft((current) => ({ ...current, metadata: e.target.value }))}
              className="min-h-[160px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-500 dark:border-zinc-800 dark:bg-[#121212]"
              spellCheck={false}
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="primary" onClick={() => void runSimulation()} isLoading={isSimulating}>
              <BellRing className="mr-2 h-4 w-4" />
              Run Simulation
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Decision Trace</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                See extracted tags, matching rules, and provider delivery decisions before shipping changes to production.
              </p>
            </div>
            <Badge variant={simulationResult ? "success" : "outline"}>{simulationResult ? "Ready" : "Awaiting input"}</Badge>
          </div>

          {!simulationResult ? (
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700">
              Run a simulation to inspect rule hits and provider outcomes.
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Extracted Tags</div>
                <div className="flex flex-wrap gap-2">
                  {simulationResult.extracted_tags.length === 0 ? (
                    <span className="text-xs text-zinc-500">No tags extracted from the sample payload.</span>
                  ) : (
                    simulationResult.extracted_tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Rule Matches</div>
                <div className="space-y-3">
                  {simulationResult.rule_results.length === 0 ? (
                    <div className="text-xs text-zinc-500">No routing rules are configured yet.</div>
                  ) : (
                    simulationResult.rule_results.map((rule) => (
                      <div key={rule.id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{rule.name}</div>
                            <div className="mt-1 text-xs text-zinc-500">{rule.integration_kind}</div>
                          </div>
                          <Badge variant={rule.matched ? "success" : "outline"}>{rule.matched ? "matched" : "skipped"}</Badge>
                        </div>
                        {!rule.matched && rule.reasons.length > 0 ? (
                          <div className="mt-2 text-xs text-zinc-500">{rule.reasons.join(" • ")}</div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Provider Decisions</div>
                <div className="space-y-3">
                  {simulationResult.providers.map((provider) => (
                    <div key={provider.kind} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{provider.name}</div>
                          <div className="mt-1 text-xs text-zinc-500">{provider.kind}</div>
                        </div>
                        <Badge variant={provider.would_deliver ? "success" : "warning"}>
                          {provider.would_deliver ? "would deliver" : "blocked"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={provider.enabled ? "success" : "outline"}>{provider.enabled ? "enabled" : "disabled"}</Badge>
                        <Badge variant={provider.interested ? "success" : "outline"}>{provider.interested ? "subscribed" : "not subscribed"}</Badge>
                        <Badge variant="outline">{provider.matched_rule_ids.length} matched rules</Badge>
                      </div>
                      {provider.decision_reasons.length > 0 ? (
                        <div className="mt-3 text-xs text-zinc-500">{provider.decision_reasons.join(" • ")}</div>
                      ) : (
                        <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
                          Delivery would proceed with the current provider and routing setup.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RulePicker({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
      <div className="flex flex-wrap gap-2">
        {values.length === 0 ? (
          <span className="text-xs text-zinc-500">No values available.</span>
        ) : (
          values.map((value) => {
            const active = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? "border-indigo-500 bg-indigo-500 text-white" : "border-zinc-200 dark:border-zinc-700"}`}
              >
                {value}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
