import { Globe } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function GatewayClassesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="gatewayclasses"
            title="Gateway Classes"
            icon={<Globe className="h-5 w-5 text-fuchsia-500" />}
            kind="gatewayclasses"
            namespaced={false}
            searchPlaceholder="Search gateway classes..."
            addLabel="Add GatewayClass"
            emptyLabel="No gateway classes found."
            starterManifest={() => `apiVersion: gateway.networking.k8s.io/v1\nkind: GatewayClass\nmetadata:\n  name: sample-gateway-class\nspec:\n  controllerName: example.net/gateway-controller\n`}
        />
    );
}
