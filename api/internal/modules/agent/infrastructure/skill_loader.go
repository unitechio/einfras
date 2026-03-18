package infrastructure

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"einfra/api/internal/modules/agent/domain"
)

// AntigravitySkillLoader loads .md and YAML definitions from the user's home Antigravity directory.
type AntigravitySkillLoader struct {
	skillsDir string
}

func NewAntigravitySkillLoader() *AntigravitySkillLoader {
	home, _ := os.UserHomeDir()
	return &AntigravitySkillLoader{
		skillsDir: filepath.Join(home, ".gemini", "antigravity", "skills"),
	}
}

func (l *AntigravitySkillLoader) LoadAvailableSkills(ctx context.Context) (map[string]*domain.Skill, error) {
	skills := make(map[string]*domain.Skill)

	// In case the directory doesn't exist yet, we don't crash, we just return empty.
	if _, err := os.Stat(l.skillsDir); os.IsNotExist(err) {
		return skills, nil
	}

	err := filepath.Walk(l.skillsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		
		// Antigravity skills primarily have a SKILL.md definition
		if !info.IsDir() && strings.HasSuffix(info.Name(), "SKILL.md") {
			contentBytes, err := os.ReadFile(path)
			if err != nil {
				return nil
			}
			
			// We parse the exact name from the parent folder mapping, e.g. "security_auditor"
			dirName := filepath.Base(filepath.Dir(path))
			skillName := "@" + strings.ReplaceAll(dirName, "_", "-")
			
			// Build minimal domain skill definition
			skill := &domain.Skill{
				Name:        skillName,
				Description: extractYAMLDescription(string(contentBytes)),
				SourceFile:  path,
				PromptBody:  string(contentBytes),
			}
			skills[skillName] = skill
		}
		return nil
	})

	return skills, err
}

func extractYAMLDescription(content string) string {
	// Simple stub to extract description from frontmatter
	lines := strings.Split(content, "\n")
	inYaml := false
	for _, line := range lines {
		if strings.TrimSpace(line) == "---" {
			inYaml = !inYaml
			continue
		}
		if inYaml && strings.HasPrefix(line, "description:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "description:"))
		}
	}
	return "No description available"
}
