import { Database } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function CRDsPage() {
    return (
        <GenericK8sResourcePage
            activeResource="crds"
            title="Custom Resource Definitions"
            icon={<Database className="h-5 w-5 text-blue-500" />}
            kind="customresourcedefinitions"
            namespaced={false}
            searchPlaceholder="Search CRDs..."
            addLabel="Add CRD"
            emptyLabel="No custom resource definitions found."
            starterManifest={() => `apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: widgets.example.com\nspec:\n  group: example.com\n  scope: Namespaced\n  names:\n    plural: widgets\n    singular: widget\n    kind: Widget\n  versions:\n  - name: v1\n    served: true\n    storage: true\n    schema:\n      openAPIV3Schema:\n        type: object\n`}
        />
    );
}
