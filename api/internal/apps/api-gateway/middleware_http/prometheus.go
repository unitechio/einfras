
package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/monitoring/domain"
)

// PrometheusMiddleware returns a gin.HandlerFunc that records Prometheus metrics.
func PrometheusMiddleware(metrics *monitoring.Metrics) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		method := c.Request.Method
		path := c.FullPath() // Use FullPath to group similar paths, e.g., /users/:id

		// Record metrics
		metrics.HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
		metrics.HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
	}
}
