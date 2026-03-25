import { Layers } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function ReplicaSetsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="replicasets"
            title="ReplicaSets"
            icon={<Layers className="h-5 w-5 text-sky-500" />}
            kind="replicasets"
            searchPlaceholder="Search replicasets..."
            addLabel="Add ReplicaSet"
            emptyLabel="No replicasets found."
            starterManifest={(namespace) => `apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: sample-replicaset\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: sample-replicaset\n  template:\n    metadata:\n      labels:\n        app: sample-replicaset\n    spec:\n      containers:\n      - name: app\n        image: nginx:stable\n`}
        />
    );
}
