package handler

import (
	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/harbor/application"
)

// HarborHandlers groups all Harbor-related handlers
type HarborHandlers struct {
	Harbor          *HarborHandler
	ImageDeployment *ImageHandler
}

// NewHarborHandlers creates a new Harbor handlers instance
func NewHarborHandlers(
	harborUC usecase.HarborUsecase,
	imageDeploymentUC usecase.ImageDeploymentUsecase,
) *HarborHandlers {
	return &HarborHandlers{
		Harbor:          NewHarborHandler(harborUC),
		ImageDeployment: NewImageHandler(imageDeploymentUC),
	}
}

// RegisterHarborRoutes registers all Harbor-related routes
func RegisterHarborRoutes(r *gin.RouterGroup, h *HarborHandlers) {
	harbor := r.Group("/harbor")
	{
		// Project routes
		harbor.GET("/projects", h.Harbor.ListProjects)
		harbor.POST("/projects", h.Harbor.CreateProject)
		harbor.GET("/projects/:project_id", h.Harbor.GetProject)
		harbor.DELETE("/projects/:project_id", h.Harbor.DeleteProject)

		// Repository routes
		repos := harbor.Group("/projects/:project_id/repositories")
		{
			repos.GET("", h.Harbor.ListRepositories)
			repos.GET("/:repo_name", h.Harbor.GetRepository)
			repos.DELETE("/:repo_name", h.Harbor.DeleteRepository)
		}

		// Artifact routes
		artifacts := harbor.Group("/projects/:project_id/repositories/:repo_name/artifacts")
		{
			artifacts.GET("", h.Harbor.ListArtifacts)
			artifacts.GET("/:tag", h.Harbor.GetArtifact)
			artifacts.DELETE("/:tag", h.Harbor.DeleteArtifact)
		}

		// Image deployment tracking
		harbor.GET("/deployments", h.ImageDeployment.ListDeployments)
		harbor.POST("/deployments", h.ImageDeployment.TrackDeployment)
		harbor.GET("/deployments/:deployment_id", h.ImageDeployment.GetDeployment)
	}
}
