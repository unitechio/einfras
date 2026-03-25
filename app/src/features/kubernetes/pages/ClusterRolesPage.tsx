import { ShieldCheck } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function ClusterRolesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="clusterroles"
            title="Cluster Roles"
            icon={<ShieldCheck className="h-5 w-5 text-rose-500" />}
            kind="clusterroles"
            namespaced={false}
            searchPlaceholder="Search cluster roles..."
            addLabel="Add ClusterRole"
            emptyLabel="No cluster roles found."
            starterManifest={() => `apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole\nmetadata:\n  name: sample-cluster-role\nrules:\n- apiGroups: [\"\"]\n  resources: [\"nodes\"]\n  verbs: [\"get\", \"list\", \"watch\"]\n`}
        />
    );
}
