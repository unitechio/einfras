import { Network } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function EndpointsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="endpoints"
            title="Endpoints"
            icon={<Network className="h-5 w-5 text-cyan-500" />}
            kind="endpoints"
            searchPlaceholder="Search endpoints..."
            addLabel="Add Endpoints"
            emptyLabel="No endpoints found."
            starterManifest={(namespace) => `apiVersion: v1\nkind: Endpoints\nmetadata:\n  name: sample-service\n  namespace: ${namespace}\nsubsets:\n- addresses:\n  - ip: 10.0.0.10\n  ports:\n  - port: 80\n    protocol: TCP\n`}
        />
    );
}
