
package session

import (
	"os"

	"github.com/gorilla/sessions"
)

const (
	// SessionName is the name of the session cookie.
	SessionName = "auth-session"
	// UserIDKey is the key for the user ID in the session.
	UserIDKey = "user_id"
	// UserRoleKey is the key for the user role in the session.
	UserRoleKey = "user_role"
)

// Store is the global session store.
var Store sessions.Store

// InitStore initializes the session store.
// It reads the SESSION_SECRET from the environment.
func InitStore() {
	// It's recommended to use a key of 32 or 64 bytes.
	authKey := []byte(os.Getenv("SESSION_SECRET"))

	Store = sessions.NewCookieStore(authKey)
}
