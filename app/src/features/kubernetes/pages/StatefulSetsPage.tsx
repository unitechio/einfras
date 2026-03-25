import { Layers } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function StatefulSetsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="statefulsets"
            title="StatefulSets"
            icon={<Layers className="h-5 w-5 text-indigo-500" />}
            kind="statefulsets"
            searchPlaceholder="Search statefulsets..."
            addLabel="Add StatefulSet"
            emptyLabel="No statefulsets found."
            starterManifest={(namespace) => `apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: sample-statefulset\n  namespace: ${namespace}\nspec:\n  serviceName: sample-statefulset\n  replicas: 1\n  selector:\n    matchLabels:\n      app: sample-statefulset\n  template:\n    metadata:\n      labels:\n        app: sample-statefulset\n    spec:\n      containers:\n      - name: app\n        image: nginx:stable\n        ports:\n        - containerPort: 80\n`}
        />
    );
}
