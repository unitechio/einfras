import { Globe } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function IngressClassesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="ingressclasses"
            title="Ingress Classes"
            icon={<Globe className="h-5 w-5 text-emerald-500" />}
            kind="ingressclasses"
            namespaced={false}
            searchPlaceholder="Search ingress classes..."
            addLabel="Add IngressClass"
            emptyLabel="No ingress classes found."
            starterManifest={() => `apiVersion: networking.k8s.io/v1\nkind: IngressClass\nmetadata:\n  name: nginx\nspec:\n  controller: k8s.io/ingress-nginx\n`}
        />
    );
}
