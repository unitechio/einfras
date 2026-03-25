import { Layers } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function DaemonSetsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="daemonsets"
            title="DaemonSets"
            icon={<Layers className="h-5 w-5 text-orange-500" />}
            kind="daemonsets"
            namespaced={false}
            searchPlaceholder="Search daemonsets..."
            addLabel="Add DaemonSet"
            emptyLabel="No daemonsets found."
            starterManifest={() => `apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: sample-daemonset\n  namespace: kube-system\nspec:\n  selector:\n    matchLabels:\n      app: sample-daemonset\n  template:\n    metadata:\n      labels:\n        app: sample-daemonset\n    spec:\n      containers:\n      - name: agent\n        image: busybox\n        command: [\"sh\", \"-c\", \"sleep 3600\"]\n`}
        />
    );
}
