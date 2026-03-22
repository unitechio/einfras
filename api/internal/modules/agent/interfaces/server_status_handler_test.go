package agenthandler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	agentregistry "einfra/api/internal/modules/agent/application"
	agent "einfra/api/internal/modules/agent/domain"
	agentpb "einfra/api/internal/modules/agent/infrastructure/grpcpb"
)

func TestGetAgentStatusUsesAnyTransportOnline(t *testing.T) {
	hub := agentregistry.GetHub()
	serverID := "server-grpc-status"
	hub.RegisterGRPCAgent(serverID, fakeConnectStreamServer{})
	t.Cleanup(func() {
		hub.UnregisterGRPCAgent(serverID)
	})

	handler := NewAgentStatusHandler(hub, stubAgentInfoReader{
		info: &agent.AgentInfo{ServerID: serverID, Version: "1.0.0"},
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/servers/"+serverID+"/agent-status", nil)
	req = mux.SetURLVars(req, map[string]string{"id": serverID})
	recorder := httptest.NewRecorder()

	handler.GetAgentStatus(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)

	var payload struct {
		Item struct {
			ServerID string `json:"server_id"`
			Online   bool   `json:"online"`
		} `json:"item"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Equal(t, serverID, payload.Item.ServerID)
	require.True(t, payload.Item.Online)
}

type stubAgentInfoReader struct {
	info *agent.AgentInfo
	err  error
}

func (s stubAgentInfoReader) GetByServerID(serverID string) (*agent.AgentInfo, error) {
	return s.info, s.err
}

type fakeConnectStreamServer struct{}

func (fakeConnectStreamServer) Send(*agentpb.ControlMessage) error { return nil }
func (fakeConnectStreamServer) Recv() (*agentpb.AgentEvent, error) { return nil, nil }
func (fakeConnectStreamServer) SetHeader(metadata.MD) error        { return nil }
func (fakeConnectStreamServer) SendHeader(metadata.MD) error       { return nil }
func (fakeConnectStreamServer) SetTrailer(metadata.MD)             {}
func (fakeConnectStreamServer) Context() context.Context           { return context.Background() }
func (fakeConnectStreamServer) SendMsg(any) error                  { return nil }
func (fakeConnectStreamServer) RecvMsg(any) error                  { return nil }
