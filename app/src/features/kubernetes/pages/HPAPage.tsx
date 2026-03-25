import { Activity } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function HPAPage() {
    return (
        <GenericK8sResourcePage
            activeResource="hpa"
            title="Horizontal Pod Autoscalers"
            icon={<Activity className="h-5 w-5 text-lime-500" />}
            kind="horizontalpodautoscalers"
            searchPlaceholder="Search HPAs..."
            addLabel="Add HPA"
            emptyLabel="No horizontal pod autoscalers found."
            starterManifest={(namespace) => `apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: sample-hpa\n  namespace: ${namespace}\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: sample-deployment\n  minReplicas: 1\n  maxReplicas: 5\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: 70\n`}
        />
    );
}
