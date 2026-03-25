//go:build legacy
// +build legacy

// Package docker provides HTTP handlers for managing Docker resources.
package docker

import (
	"net/http"
	"strconv"
	"time"

	dockerclient "einfra/api/docker/client"
	einfra "einfra/api/internal"
	"einfra/api/internal/response"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// Handler handles all Docker-related HTTP endpoints for an Environment.
type Handler struct {
	factory *dockerclient.ClientFactory
}

// NewHandler constructs a new Docker endpoint Handler.
func NewHandler(factory *dockerclient.ClientFactory) *Handler {
	return &Handler{
		factory: factory,
	}
}

// RegisterRoutes mounts all Docker APIs under the specified subrouter.
func (h *Handler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/servers/{serverId}/docker/info", h.DockerInfo).Methods(http.MethodGet)

	// Containers
	r.HandleFunc("/servers/{serverId}/docker/containers", h.ListContainers).Methods(http.MethodGet)
	r.HandleFunc("/servers/{serverId}/docker/containers/{containerId}/start", h.StartContainer).Methods(http.MethodPost)
	r.HandleFunc("/servers/{serverId}/docker/containers/{containerId}/stop", h.StopContainer).Methods(http.MethodPost)
	r.HandleFunc("/servers/{serverId}/docker/containers/{containerId}/restart", h.RestartContainer).Methods(http.MethodPost)
	r.HandleFunc("/servers/{serverId}/docker/containers/{containerId}/remove", h.RemoveContainer).Methods(http.MethodDelete)

	// Images
	r.HandleFunc("/servers/{serverId}/docker/images", h.ListImages).Methods(http.MethodGet)
}

// ======================= Handlers ==============================

// DockerInfo returns system-wide Docker information.
func (h *Handler) DockerInfo(w http.ResponseWriter, r *http.Request) {
	cli, err := h.getClient(r)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	defer cli.Close()

	info, err := cli.Info(r.Context())
	if err != nil {
		response.InternalError(w, err)
		return
	}
	response.OK(w, info)
}

// ListContainers returns a list of Docker containers.
func (h *Handler) ListContainers(w http.ResponseWriter, r *http.Request) {
	cli, err := h.getClient(r)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	defer cli.Close()

	opts := container.ListOptions{All: true} // show all by default
	if r.URL.Query().Get("all") == "false" {
		opts.All = false
	}

	containers, err := cli.ContainerList(r.Context(), opts)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	response.OK(w, containers)
}

// StartContainer starts an existing container.
func (h *Handler) StartContainer(w http.ResponseWriter, r *http.Request) {
	containerId := mux.Vars(r)["containerId"]
	cli, err := h.getClient(r)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	defer cli.Close()

	if err := cli.ContainerStart(r.Context(), containerId, container.StartOptions{}); err != nil {
		response.InternalError(w, err)
		return
	}
	response.Message(w, "Container started")
}

// StopContainer stops an existing container.
func (h *Handler) StopContainer(w http.ResponseWriter, r *http.Request) {
	containerId := mux.Vars(r)["containerId"]
	cli, err := h.getClient(r)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	defer cli.Close()

	timeout := 10
	if tStr := r.URL.Query().Get("timeout"); tStr != "" {
		if t, err := strconv.Atoi(tStr); err == nil {
			timeout = t
		}
	}
	opts := container.StopOptions{Timeout: &timeout}

	if err := cli.ContainerStop(r.Context(), containerId, opts); err != nil {
		response.InternalError(w, err)
		return
	}
	response.Message(w, "Container stopped")
}

// RestartContainer restarts an existing container.
func (h *Handler) RestartContainer(w http.ResponseWriter, r *http.Request) {
	containerId := mux.Vars(r)["containerId"]
	cli, err := h.getClient(r)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	defer cli.Close()

	opts := container.StopOptions{}
	if err := cli.ContainerRestart(r.Context(), containerId, opts); err != nil {
		response.InternalError(w, err)
		return
	}
	response.Message(w, "Container restarted")
}

// RemoveContainer removes a container.
func (h *Handler) RemoveContainer(w http.ResponseWriter, r *http.Request) {
	containerId := mux.Vars(r)["containerId"]
	force := r.URL.Query().Get("force") == "true"
	volumes := r.URL.Query().Get("v") == "true"

	cli, err := h.getClient(r)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	defer cli.Close()

	opts := container.RemoveOptions{
		Force:         force,
		RemoveVolumes: volumes,
	}

	if err := cli.ContainerRemove(r.Context(), containerId, opts); err != nil {
		response.InternalError(w, err)
		return
	}
	response.Message(w, "Container removed")
}

// ListImages dumps Docker images.
func (h *Handler) ListImages(w http.ResponseWriter, r *http.Request) {
	cli, err := h.getClient(r)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	defer cli.Close()

	opts := image.ListOptions{All: false}
	imagesList, err := cli.ImageList(r.Context(), opts)
	if err != nil {
		response.InternalError(w, err)
		return
	}
	response.OK(w, imagesList)
}

// --- Internal Helpers ---

// getClient creates a Docker Client for the target server.
// It maps the `serverId` to an Endpoint struct and establishes a Docker SDK client.
func (h *Handler) getClient(r *http.Request) (*client.Client, error) { // Using actual Client return
	// In production, fetch the Endpoint from Database using `mux.Vars(r)["serverId"]`
	// Fallback to local socket for dev test:
	endpoint := &einfra.Endpoint{
		Type: einfra.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}

	// Default client timeout 30s
	timeout := 30 * time.Second
	cli, err := h.factory.CreateClient(endpoint, "", &timeout)
	if err != nil {
		log.Error().Err(err).Msg("failed to create docker client")
		return nil, err
	}
	return cli, nil
}
