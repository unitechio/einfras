import { ShieldCheck } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function RolesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="roles"
            title="Roles"
            icon={<ShieldCheck className="h-5 w-5 text-violet-500" />}
            kind="roles"
            searchPlaceholder="Search roles..."
            addLabel="Add Role"
            emptyLabel="No roles found."
            starterManifest={(namespace) => `apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: sample-role\n  namespace: ${namespace}\nrules:\n- apiGroups: [\"\"]\n  resources: [\"pods\"]\n  verbs: [\"get\", \"list\", \"watch\"]\n`}
        />
    );
}
