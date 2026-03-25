import { ShieldCheck } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function ClusterRoleBindingsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="clusterrolebindings"
            title="Cluster Role Bindings"
            icon={<ShieldCheck className="h-5 w-5 text-pink-500" />}
            kind="clusterrolebindings"
            namespaced={false}
            searchPlaceholder="Search cluster role bindings..."
            addLabel="Add ClusterRoleBinding"
            emptyLabel="No cluster role bindings found."
            starterManifest={() => `apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRoleBinding\nmetadata:\n  name: sample-cluster-rolebinding\nsubjects:\n- kind: ServiceAccount\n  name: default\n  namespace: default\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: ClusterRole\n  name: sample-cluster-role\n`}
        />
    );
}
