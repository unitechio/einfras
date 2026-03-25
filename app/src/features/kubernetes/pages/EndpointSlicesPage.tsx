import { Network } from "lucide-react";
import { GenericK8sResourcePage } from "./GenericK8sResourcePage";

export default function EndpointSlicesPage() {
    return (
        <GenericK8sResourcePage
            activeResource="endpointslices"
            title="Endpoint Slices"
            icon={<Network className="h-5 w-5 text-sky-500" />}
            kind="endpointslices"
            searchPlaceholder="Search endpoint slices..."
            addLabel="Add EndpointSlice"
            emptyLabel="No endpoint slices found."
            starterManifest={(namespace) => `apiVersion: discovery.k8s.io/v1\nkind: EndpointSlice\nmetadata:\n  name: sample-service-1\n  namespace: ${namespace}\n  labels:\n    kubernetes.io/service-name: sample-service\naddressType: IPv4\nports:\n- name: http\n  protocol: TCP\n  port: 80\nendpoints:\n- addresses:\n  - 10.0.0.10\n`}
        />
    );
}
