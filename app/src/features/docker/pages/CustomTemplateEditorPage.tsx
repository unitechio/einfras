import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Code, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";
import {
  findTemplateById,
  loadTemplates,
  saveTemplates,
} from "./custom-template-store";

type TemplateParameterRow = { key: string; value: string };

export default function CustomTemplateEditorPage() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const template = findTemplateById(templateId);
  const isCreate = !templateId || templateId === "new" || !template;
  const [draftName, setDraftName] = useState(template?.name || "");
  const [draftType, setDraftType] = useState(template?.type || "Compose");
  const [draftContent, setDraftContent] = useState(
    template?.content || "services:\n  app:\n    image: nginx:stable-alpine",
  );
  const [parameterRows, setParameterRows] = useState<TemplateParameterRow[]>(
    (template?.settings || "environment=dev")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((row) => {
        const [key, ...rest] = row.split("=");
        return { key: key?.trim() || "", value: rest.join("=").trim() };
      }),
  );
  const { showNotification } = useNotification();

  const generatedPreview = useMemo(() => {
    const params = parameterRows.filter((row) => row.key.trim());
    if (draftType === "Container") {
      const envBlock =
        params.length > 0
          ? `\nenvironment:\n${params.map((row) => `  ${row.key}: \"${row.value}\"`).join("\n")}`
          : "";
      return `${draftContent.trim()}${envBlock}`;
    }
    const envBlock =
      params.length > 0
        ? `\n    environment:\n${params.map((row) => `      ${row.key}: \"${row.value}\"`).join("\n")}`
        : "";
    if (draftContent.includes("environment:")) return draftContent;
    return `${draftContent.trim()}${envBlock}`;
  }, [draftContent, draftType, parameterRows]);

  const saveTemplate = () => {
    if (!draftName.trim()) {
      showNotification({
        type: "error",
        message: "Template name required",
        description: "Please provide a template name.",
      });
      return;
    }
    const normalizedSettings = parameterRows
      .filter((row) => row.key.trim())
      .map((row) => `${row.key.trim()}=${row.value}`)
      .join("\n");
    const items = loadTemplates();
    const nextItem = {
      id: template?.id || Date.now(),
      name: draftName.trim(),
      type: draftType,
      lastUpdated: new Date().toISOString().slice(0, 10),
      author: template?.author || "Admin",
      content: generatedPreview,
      settings: normalizedSettings,
    };
    saveTemplates(
      isCreate
        ? [nextItem, ...items]
        : items.map((item) => (item.id === template?.id ? nextItem : item)),
    );
    showNotification({
      type: "success",
      message: isCreate ? "Template created" : "Template updated",
      description: nextItem.name,
    });
    navigate("/templates/custom");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/templates/custom")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to templates
          </Button>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Code className="h-6 w-6 text-indigo-500" />
            {isCreate ? "Create Template" : "Edit Template"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Clean dedicated page for editing YAML and parameterized inputs
            without squeezing everything into a modal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                `/containers/deploy?mode=${draftType === "Compose" ? "compose" : "single"}`,
              )
            }
          >
            Deploy
          </Button>
          <Button variant="primary" onClick={saveTemplate}>
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Template Name">
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Template name"
              />
            </Field>
            <Field label="Template Type">
              <select
                value={draftType}
                onChange={(event) => setDraftType(event.target.value)}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212] w-full"
              >
                <option value="Compose">Compose</option>
                <option value="Container">Container</option>
              </select>
            </Field>
          </div>
          <Field label="Template Content">
            <textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              spellCheck={false}
              className="min-h-[520px] w-full rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </Field>
        </div>

        <div className="space-y-5">
          <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Template Parameters
                </div>
                <div className="text-xs text-zinc-500">
                  Use form inputs to refill YAML consistently for users who
                  prefer not to hand-edit env blocks.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setParameterRows((current) => [
                    ...current,
                    { key: "", value: "" },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add input
              </Button>
            </div>
            <div className="space-y-2">
              {parameterRows.map((row, index) => (
                <div
                  key={`param-${index}`}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2"
                >
                  <Input
                    value={row.key}
                    onChange={(event) =>
                      setParameterRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, key: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="environment"
                  />
                  <Input
                    value={row.value}
                    onChange={(event) =>
                      setParameterRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="prod"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setParameterRows((current) =>
                        current.length > 1
                          ? current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            )
                          : [{ key: "", value: "" }],
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Generated Preview
            </div>
            <textarea
              value={generatedPreview}
              onChange={(event) => setDraftContent(event.target.value)}
              spellCheck={false}
              className="min-h-[320px] w-full rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      {children}
    </div>
  );
}
