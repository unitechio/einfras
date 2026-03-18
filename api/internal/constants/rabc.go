package constants

// ContextKey is a custom type for context keys to avoid collisions.
type ContextKey string

const (
	// UserContextKey is the key for storing the user object in the request context.
	UserContextKey ContextKey = "user"
)

// =============================================================================
// Role-Based Access Control (RBAC) Constants
// =============================================================================

// Role represents a user's role within the system.
// Use these constants in middleware.RequireRoles().
type Role string

const (
	RoleAdmin       Role = "admin"        // Full access to the system.
	RoleManager     Role = "manager"      // Can manage users and specific resources.
	RoleUser        Role = "user"         // General user with standard access.
	RoleGuest       Role = "guest"        // Limited access for unauthenticated or new users.
	RoleSystemAgent Role = "system_agent" // For internal, machine-to-machine communication.
)

// Permission represents a specific action that can be performed.
// These can be used for more fine-grained control beyond simple roles.
type Permission string

const (
	// User permissions
	PermUserRead   Permission = "users:read"
	PermUserCreate Permission = "users:create"
	PermUserUpdate Permission = "users:update"
	PermUserDelete Permission = "users:delete"

	// Product permissions
	PermProductRead   Permission = "products:read"
	PermProductCreate Permission = "products:create"
	PermProductUpdate Permission = "products:update"
	PermProductDelete Permission = "products:delete"

	// Billing permissions
	PermBillingRead   Permission = "billing:read"
	PermBillingManage Permission = "billing:manage"
)

// Department can be used to segregate data and permissions by business unit.
type Department string

const (
	DeptEngineering Department = "engineering"
	DeptSales       Department = "sales"
	DeptMarketing   Department = "marketing"
	DeptSupport     Department = "support"
	DeptGeneral     Department = "general"
)

// =============================================================================
// OAuth 2.0 / JWT Scope Constants
// =============================================================================

// Scope defines the extent of access a token has.
// These are typically checked after authenticating a token.
type Scope string

const (
	ScopeReadPublic Scope = "read:public" // Read public-facing information.
	ScopeReadUser   Scope = "read:user"   // Read the user's own data.
	ScopeWriteUser  Scope = "write:user"  // Write/modify the user's own data.
	ScopeReadAdmin  Scope = "read:admin"  // Read admin-level information.
	ScopeWriteAdmin Scope = "write:admin" // Write/modify admin-level data.
)
