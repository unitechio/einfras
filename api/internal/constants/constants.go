package constants

// SessionRecordingService is used to differentiate session recording services.
type SessionRecordingService int

const (
	// SessionRecordingServiceSSH represents the SSH service session.
	SessionRecordingServiceSSH SessionRecordingService = iota
)

// SessionRecordingMode determines how session recording will behave in failure
// scenarios.
type SessionRecordingMode string

const (
	// SessionRecordingModeStrict causes any failure session recording to
	// terminate the session or prevent a new session from starting.
	SessionRecordingModeStrict = SessionRecordingMode("strict")

	// SessionRecordingModeBestEffort allows the session to keep going even when
	// session recording fails.
	SessionRecordingModeBestEffort = SessionRecordingMode("best_effort")
)

// ShowResources determines which resources are shown in the web UI. Default if unset is "requestable"
// which means resources the user has access to and resources they can request will be shown in the
// resources UI. If set to `accessible_only`, only resources the user already has access to will be shown.
type ShowResources string

const (
	// ShowResourcesaccessibleOnly will only show resources the user currently has access to.
	ShowResourcesaccessibleOnly = ShowResources("accessible_only")

	// ShowResourcesRequestable will allow resources that the user can request into resources page.
	ShowResourcesRequestable = ShowResources("requestable")
)
