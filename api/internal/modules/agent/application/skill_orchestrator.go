package agentregistry

import (
	"context"
	"fmt"
	"strings"

	agent "einfra/api/internal/modules/agent/domain"
)

// AgentDispatcher Port specifies how control plane tells Agent to execute.
type AgentDispatcher interface {
	// DispatchSkillWithRetry communicates via gRPC to trigger the local binary/skill execution
	DispatchSkillWithRetry(ctx context.Context, serverID string, skillName string, wCtx map[string]string) (*agent.SkillResult, error)
}

// SkillOrchestrator resolves strings into a DAG Execution Graph.
// It chains skills sequentially, passing each node's output as the next node's context.
type SkillOrchestrator struct {
	dispatcher AgentDispatcher
}

func NewSkillOrchestrator(dispatcher AgentDispatcher) *SkillOrchestrator {
	return &SkillOrchestrator{
		dispatcher: dispatcher,
	}
}

// RunAIPipeline takes a user prompt, builds a DAG execution chain, and runs each Skill node.
func (o *SkillOrchestrator) RunAIPipeline(ctx context.Context, serverID string, userPrompt string) (*agent.SkillResult, error) {
	wCtx := make(map[string]string)
	wCtx["original_requirements"] = userPrompt

	chain := []string{"@brainstorming", "@architecture", "@security-auditor"}
	fmt.Printf("[SkillOrchestrator] DAG plan for server %s: %s\n", serverID, strings.Join(chain, " -> "))

	var lastResult *agent.SkillResult

	for _, skill := range chain {
		fmt.Printf("[SkillOrchestrator] -> Node: %s\n", skill)

		res, err := o.dispatcher.DispatchSkillWithRetry(ctx, serverID, skill, wCtx)
		if err != nil {
			return nil, fmt.Errorf("workflow aborted at %s: %w", skill, err)
		}

		// Accumulate: previous result becomes next node's context
		wCtx[skill+"_output"] = res.Output
		lastResult = res
		fmt.Printf("[SkillOrchestrator] Node %s completed.\n", skill)
	}

	fmt.Println("[SkillOrchestrator] Workflow complete!")
	return lastResult, nil
}
