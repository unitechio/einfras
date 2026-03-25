import { Activity } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function VPAPage() {
    return (
        <GenericK8sResourcePage
            activeResource="vpa"
            title="Vertical Pod Autoscalers"
            icon={<Activity className="h-5 w-5 text-rose-500" />}
            kind="verticalpodautoscalers"
            searchPlaceholder="Search vertical pod autoscalers..."
            addLabel="Add VPA"
            emptyLabel="No vertical pod autoscalers found."
            starterManifest={(namespace) => `apiVersion: autoscaling.k8s.io/v1\nkind: VerticalPodAutoscaler\nmetadata:\n  name: sample-vpa\n  namespace: ${namespace}\nspec:\n  targetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: sample-deployment\n  updatePolicy:\n    updateMode: Auto\n`}
        />
    );
}
