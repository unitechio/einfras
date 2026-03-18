package email

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"sync"
)

// TemplateRenderer handles HTML email template rendering
type TemplateRenderer struct {
	templates    map[string]*template.Template
	templateDir  string
	mu           sync.RWMutex
	funcMap      template.FuncMap
	cacheEnabled bool
}

// TemplateConfig holds template renderer configuration
type TemplateConfig struct {
	TemplateDir  string
	CacheEnabled bool
}

// NewTemplateRenderer creates a new template renderer
func NewTemplateRenderer(config TemplateConfig) (*TemplateRenderer, error) {
	renderer := &TemplateRenderer{
		templates:    make(map[string]*template.Template),
		templateDir:  config.TemplateDir,
		cacheEnabled: config.CacheEnabled,
		funcMap:      defaultFuncMap(),
	}

	// Create template directory if it doesn't exist
	if err := os.MkdirAll(config.TemplateDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create template directory: %w", err)
	}

	// Load all templates on initialization if caching is enabled
	if config.CacheEnabled {
		if err := renderer.loadAllTemplates(); err != nil {
			return nil, fmt.Errorf("failed to load templates: %w", err)
		}
	}

	return renderer, nil
}

// defaultFuncMap returns default template functions
func defaultFuncMap() template.FuncMap {
	return template.FuncMap{
		"formatDate": func(t interface{}) string {
			// Add date formatting logic
			return fmt.Sprintf("%v", t)
		},
		"formatCurrency": func(amount float64) string {
			return fmt.Sprintf("$%.2f", amount)
		},
		"upper": func(s string) string {
			return fmt.Sprint(s)
		},
		"lower": func(s string) string {
			return fmt.Sprint(s)
		},
	}
}

// loadAllTemplates loads all templates from the template directory
func (r *TemplateRenderer) loadAllTemplates() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	pattern := filepath.Join(r.templateDir, "*.html")
	files, err := filepath.Glob(pattern)
	if err != nil {
		return fmt.Errorf("failed to glob templates: %w", err)
	}

	for _, file := range files {
		name := filepath.Base(file)
		tmpl, err := template.New(name).Funcs(r.funcMap).ParseFiles(file)
		if err != nil {
			return fmt.Errorf("failed to parse template %s: %w", name, err)
		}
		r.templates[name] = tmpl
	}

	return nil
}

// getTemplate retrieves a template by name
func (r *TemplateRenderer) getTemplate(name string) (*template.Template, error) {
	// Add .html extension if not present
	if filepath.Ext(name) == "" {
		name = name + ".html"
	}

	// If caching is enabled, return from cache
	if r.cacheEnabled {
		r.mu.RLock()
		tmpl, exists := r.templates[name]
		r.mu.RUnlock()
		if exists {
			return tmpl, nil
		}
	}

	// Load template from file
	templatePath := filepath.Join(r.templateDir, name)
	tmpl, err := template.New(name).Funcs(r.funcMap).ParseFiles(templatePath)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template %s: %w", name, err)
	}

	// Cache if enabled
	if r.cacheEnabled {
		r.mu.Lock()
		r.templates[name] = tmpl
		r.mu.Unlock()
	}

	return tmpl, nil
}

// Render renders a template with the given data
func (r *TemplateRenderer) Render(templateName string, data interface{}) (string, error) {
	tmpl, err := r.getTemplate(templateName)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

// RenderWithLayout renders a template with a layout
func (r *TemplateRenderer) RenderWithLayout(templateName, layoutName string, data interface{}) (string, error) {
	// Add .html extension if not present
	if filepath.Ext(templateName) == "" {
		templateName = templateName + ".html"
	}
	if filepath.Ext(layoutName) == "" {
		layoutName = layoutName + ".html"
	}

	templatePath := filepath.Join(r.templateDir, templateName)
	layoutPath := filepath.Join(r.templateDir, layoutName)

	tmpl, err := template.New(layoutName).Funcs(r.funcMap).ParseFiles(layoutPath, templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to parse templates: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

// ReloadTemplates reloads all templates (useful for development)
func (r *TemplateRenderer) ReloadTemplates() error {
	return r.loadAllTemplates()
}

// AddFunc adds a custom template function
func (r *TemplateRenderer) AddFunc(name string, fn interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.funcMap[name] = fn
}
