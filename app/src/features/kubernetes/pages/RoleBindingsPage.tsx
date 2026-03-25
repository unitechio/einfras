import { ShieldCheck } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function RoleBindingsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="rolebindings"
            title="Role Bindings"
            icon={<ShieldCheck className="h-5 w-5 text-fuchsia-500" />}
            kind="rolebindings"
            searchPlaceholder="Search role bindings..."
            addLabel="Add RoleBinding"
            emptyLabel="No role bindings found."
            starterManifest={(namespace) => `apiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: sample-rolebinding\n  namespace: ${namespace}\nsubjects:\n- kind: ServiceAccount\n  name: default\n  namespace: ${namespace}\nroleRef:\n  apiGroup: rbac.authorization.k8s.io\n  kind: Role\n  name: sample-role\n`}
        />
    );
}
