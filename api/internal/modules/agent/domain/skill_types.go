package agent

// Skill represents an executable Antigravity Workflow component loaded from '.md'.
type Skill struct {
	Name        string `json:"name"`        // The unique token, e.g., "@security-auditor"
	Description string `json:"description"` // Extracted from YAML Header
	SourceFile  string `json:"source_file"` // For logging purposes
	PromptBody  string `json:"-"`           // The massive intelligence payload text
}

// ExecutionContext retains conversational flow tokens across a DAG workflow.
type ExecutionContext struct {
	OriginalRequest string `json:"original_request"`
	History         map[string]string `json:"history"` // E.g., "@brainstorming_out": "Result"
}

// SkillResult represents the return of a locally triggered skill via gRPC stream
type SkillResult struct {
	ExitCode int32  `json:"exit_code"`
	Output   string `json:"output"` // Extracted intelligent response/report
}
