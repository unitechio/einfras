package agent

import "sort"

type ControlOperationDefinition struct {
	Name         string
	Resource     string
	Capability   string
	AllowedRoles []string
}

func (d ControlOperationDefinition) RequiredCapability() string {
	if d.Capability != "" {
		return d.Capability
	}
	return d.Name
}

var controlOperationCatalog = []ControlOperationDefinition{
	{Name: "file.read", Resource: "file", AllowedRoles: []string{"admin", "operator", "viewer"}},
	{Name: "file.list", Resource: "directory", AllowedRoles: []string{"admin", "operator", "viewer"}},
	{Name: "file.write", Resource: "file", AllowedRoles: []string{"admin", "operator"}},
	{Name: "file.chmod", Resource: "file", AllowedRoles: []string{"admin"}},
	{Name: "process.signal", Resource: "process", AllowedRoles: []string{"admin", "operator"}},
	{Name: "package.list", Resource: "package", AllowedRoles: []string{"admin", "operator", "viewer"}},
	{Name: "package.install", Resource: "package", AllowedRoles: []string{"admin"}},
	{Name: "package.remove", Resource: "package", AllowedRoles: []string{"admin"}},
	{Name: "package.update", Resource: "package", AllowedRoles: []string{"admin"}},
	{Name: "access.list-users", Resource: "access", AllowedRoles: []string{"admin", "operator"}},
	{Name: "access.list-groups", Resource: "access", AllowedRoles: []string{"admin", "operator"}},
	{Name: "access.add-user", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "access.update-user", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "access.delete-user", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "access.add-group", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "access.update-group", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "access.delete-group", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "access.list-ssh-keys", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "access.add-ssh-key", Resource: "access", AllowedRoles: []string{"admin"}},
	{Name: "config.read", Resource: "config", AllowedRoles: []string{"admin", "operator"}},
	{Name: "config.write", Resource: "config", AllowedRoles: []string{"admin"}},
	{Name: "config.list-env", Resource: "config", AllowedRoles: []string{"admin"}},
	{Name: "plugin.list", Resource: "plugin", AllowedRoles: []string{"admin", "operator"}},
	{Name: "plugin.enable", Resource: "plugin", AllowedRoles: []string{"admin"}},
	{Name: "plugin.disable", Resource: "plugin", AllowedRoles: []string{"admin"}},
	{Name: "plugin.capabilities", Resource: "plugin", Capability: "control-operation", AllowedRoles: []string{"admin", "operator", "viewer"}},
	{Name: "log.tail", Resource: "log_file", AllowedRoles: []string{"admin", "operator", "viewer"}},
}

func ControlOperationCatalog() []ControlOperationDefinition {
	items := make([]ControlOperationDefinition, len(controlOperationCatalog))
	copy(items, controlOperationCatalog)
	return items
}

func LookupControlOperation(name string) (ControlOperationDefinition, bool) {
	for _, item := range controlOperationCatalog {
		if item.Name == name {
			return item, true
		}
	}
	return ControlOperationDefinition{}, false
}

func IsKnownControlOperation(name string) bool {
	_, ok := LookupControlOperation(name)
	return ok
}

func ControlOperationNames() []string {
	items := make([]string, 0, len(controlOperationCatalog))
	for _, item := range controlOperationCatalog {
		items = append(items, item.Name)
	}
	sort.Strings(items)
	return items
}

func ControlOperationAllowedRoles(name string) []string {
	item, ok := LookupControlOperation(name)
	if !ok {
		return nil
	}
	roles := make([]string, len(item.AllowedRoles))
	copy(roles, item.AllowedRoles)
	return roles
}

func ControlOperationRequiredCapability(name string) string {
	item, ok := LookupControlOperation(name)
	if !ok {
		return name
	}
	return item.RequiredCapability()
}

func AgentAdvertisedCapabilities() []string {
	set := map[string]struct{}{
		"shell":             {},
		"service-proxy":     {},
		"control-operation": {},
	}
	for _, item := range controlOperationCatalog {
		set[item.Name] = struct{}{}
		set[item.RequiredCapability()] = struct{}{}
	}
	items := make([]string, 0, len(set))
	for item := range set {
		items = append(items, item)
	}
	sort.Strings(items)
	return items
}
