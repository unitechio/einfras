import { ShieldCheck } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function ServiceAccountsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="serviceaccounts"
            title="Service Accounts"
            icon={<ShieldCheck className="h-5 w-5 text-cyan-500" />}
            kind="serviceaccounts"
            searchPlaceholder="Search service accounts..."
            addLabel="Add ServiceAccount"
            emptyLabel="No service accounts found."
            starterManifest={(namespace) => `apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: sample-service-account\n  namespace: ${namespace}\n`}
        />
    );
}
