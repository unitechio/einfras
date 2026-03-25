import { Globe } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function GatewaysPage() {
    return (
        <GenericK8sResourcePage
            activeResource="gateways"
            title="Gateways"
            icon={<Globe className="h-5 w-5 text-violet-500" />}
            kind="gateways"
            searchPlaceholder="Search gateways..."
            addLabel="Add Gateway"
            emptyLabel="No gateways found."
            starterManifest={(namespace) => `apiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: sample-gateway\n  namespace: ${namespace}\nspec:\n  gatewayClassName: sample-gateway-class\n  listeners:\n  - name: http\n    protocol: HTTP\n    port: 80\n`}
        />
    );
}
