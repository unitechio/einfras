package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/constants"
	"einfra/api/internal/domain"
	"einfra/api/internal/usecase"
	"einfra/api/pkg/errorx"
)

// ImageHandler handles HTTP requests for image operations.
type ImageHandler struct {
	imageUsecase usecase.ImageUsecase
}

// NewImageHandler creates a new image handler.
func NewImageHandler(uc usecase.ImageUsecase) *ImageHandler {
	return &ImageHandler{imageUsecase: uc}
}

// UploadImage handles the image upload request.
// @Summary Upload an image
// @Description Upload an image file
// @Tags images
// @Accept multipart/form-data
// @Produce json
// @Param image formData file true "Image file"
// @Success 201 {object} map[string]interface{} "Image uploaded successfully"
// @Failure 400 {object} errorx.Error "Invalid request or missing image file"
// @Failure 401 {object} errorx.Error "User not authenticated"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/images/upload [post]
// @Security BearerAuth
func (h *ImageHandler) UploadImage(c *gin.Context) {
	// 1. Get the user from the context (set by AuthMiddleware)
	user, ok := c.Request.Context().Value(constants.UserContextKey).(*domain.User)
	if !ok || user == nil {
		c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
		return
	}

	// 2. Get the file from the form
	file, err := c.FormFile("image")
	if err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Image file not found in request"))
		return
	}

	// 3. Call the usecase to handle the upload
	image, err := h.imageUsecase.UploadImage(c.Request.Context(), user.ID, file)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to upload image"))
		return
	}

	// 4. Return the details of the uploaded image
	c.JSON(http.StatusCreated, gin.H{
		"message": "Image uploaded successfully",
		"data":    image,
	})
}
