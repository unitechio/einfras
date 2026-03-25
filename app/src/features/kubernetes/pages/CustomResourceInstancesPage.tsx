import { useMemo } from "react";
import { Database } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function CustomResourceInstancesPage() {
    const [params] = useSearchParams();
    const kind = params.get("kind")?.trim() || "widgets";
    const title = params.get("title")?.trim() || `Custom Resources: ${kind}`;
    const namespaced = params.get("namespaced") !== "false";

    const starterManifest = useMemo(
        () => (namespace: string) =>
            `apiVersion: ${params.get("apiVersion") || "example.com/v1"}\nkind: ${params.get("resourceKind") || "Widget"}\nmetadata:\n  name: sample-${kind.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}\n${
                namespaced ? `  namespace: ${namespace}\n` : ""
            }spec:\n  enabled: true\n`,
        [kind, namespaced, params],
    );

    return (
        <GenericK8sResourcePage
            activeResource="custom-resources"
            title={title}
            icon={<Database className="h-5 w-5 text-blue-500" />}
            kind={kind}
            namespaced={namespaced}
            searchPlaceholder={`Search ${title.toLowerCase()}...`}
            addLabel={`Add ${params.get("resourceKind") || "Custom Resource"}`}
            emptyLabel={`No ${title.toLowerCase()} found.`}
            starterManifest={starterManifest}
        />
    );
}
