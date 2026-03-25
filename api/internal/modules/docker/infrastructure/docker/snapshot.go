//go:build legacy
// +build legacy

package docker

import (
	dockerclient "einfra/api/docker/client"
	einfra "einfra/api/internal"
	"einfra/pkg/snapshot"
)

type Snapshotter struct {
	clientFactory *dockerclient.ClientFactory
}

func NewSnapshotter(clientFactory *dockerclient.ClientFactory) *Snapshotter {
	return &Snapshotter{
		clientFactory: clientFactory,
	}
}

// CreateSnapshot creates a snapshot of a specific Docker environment(endpoint)
func (snapshotter *Snapshotter) CreateSnapshot(endpoint *einfra.Endpoint) (*einfra.DockerSnapshot, error) {
	cli, err := snapshotter.clientFactory.CreateClient(endpoint, "", nil)
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	return snapshot.CreateDockerSnapshot(cli)
}
