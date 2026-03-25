import { Database } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function StorageClassesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="storageclasses"
            title="StorageClasses"
            icon={<Database className="h-5 w-5 text-amber-500" />}
            kind="storageclasses"
            namespaced={false}
            searchPlaceholder="Search storage classes..."
            addLabel="Add StorageClass"
            emptyLabel="No storage classes found."
            starterManifest={() => `apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: sample-storageclass\nprovisioner: kubernetes.io/no-provisioner\nvolumeBindingMode: WaitForFirstConsumer\n`}
        />
    );
}
