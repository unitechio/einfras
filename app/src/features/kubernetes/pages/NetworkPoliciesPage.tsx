import { ShieldCheck } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function NetworkPoliciesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="networkpolicies"
            title="Network Policies"
            icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
            kind="networkpolicies"
            searchPlaceholder="Search network policies..."
            addLabel="Add NetworkPolicy"
            emptyLabel="No network policies found."
            starterManifest={(namespace) => `apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny\n  namespace: ${namespace}\nspec:\n  podSelector: {}\n  policyTypes:\n  - Ingress\n  - Egress\n`}
        />
    );
}
