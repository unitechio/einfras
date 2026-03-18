package handler

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/auth/application"
	"einfra/api/internal/domain"
)

type PingHandler struct {
	auditService usecase.AuditUsecase
}

func NewPingHandler(as usecase.AuditUsecase) *PingHandler {
	return &PingHandler{auditService: as}
}

func (h *PingHandler) Ping(c *gin.Context) {
	auditEntry := domain.AuditLog{
		Action:      domain.AuditActionRead,
		Resource:    "SystemHealth",
		Description: "Ping-pong health check was performed",
	}

	if err := h.auditService.Log(c.Request.Context(), &auditEntry); err != nil {
		log.Printf("Failed to write audit log for ping: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "pong"})
}
