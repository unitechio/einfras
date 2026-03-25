import { Globe } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function HTTPRoutesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="httproutes"
            title="HTTP Routes"
            icon={<Globe className="h-5 w-5 text-amber-500" />}
            kind="httproutes"
            searchPlaceholder="Search HTTP routes..."
            addLabel="Add HTTPRoute"
            emptyLabel="No HTTP routes found."
            starterManifest={(namespace) => `apiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: sample-route\n  namespace: ${namespace}\nspec:\n  parentRefs:\n  - name: sample-gateway\n  hostnames:\n  - sample.local\n  rules:\n  - backendRefs:\n    - name: sample-service\n      port: 80\n`}
        />
    );
}
