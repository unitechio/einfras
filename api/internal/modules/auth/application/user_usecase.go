//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"
	"time"

	"einfra/api/internal/modules/auth/domain"
	"einfra/api/internal/modules/auth/infrastructure"
	"einfra/api/internal/domain"
	"github.com/xuri/excelize/v2"
)

type UserUsecase interface {
	CreateUser(ctx context.Context, user *domain.User, password string) error
	GetUser(ctx context.Context, id string) (*domain.User, error)
	ListUsers(ctx context.Context, filter domain.UserFilter) ([]*domain.User, int64, error)
	UpdateUser(ctx context.Context, user *domain.User) error
	DeleteUser(ctx context.Context, id string) error
	ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error
	ResetPassword(ctx context.Context, userID, newPassword string) error
	UpdateUserSettings(ctx context.Context, userID string, settings domain.UserSettings) error
	ImportUsersFromExcel(ctx context.Context, filePath string) error
	ExportUsersToExcel(ctx context.Context) (*excelize.File, string, error)
}

type userUsecase struct {
	userRepo repository.UserRepository
	roleRepo repository.RoleRepository
	authRepo repository.AuthRepository
	jwt      *auth.JWTService
}

func NewUserUsecase(
	userRepo repository.UserRepository,
	roleRepo repository.RoleRepository,
	authRepo repository.AuthRepository,
	jwt *auth.JWTService,
) UserUsecase {
	return &userUsecase{
		userRepo: userRepo,
		roleRepo: roleRepo,
		authRepo: authRepo,
		jwt:      jwt,
	}
}

func (u *userUsecase) CreateUser(ctx context.Context, user *domain.User, password string) error {
	existingUser, _ := u.userRepo.GetByEmail(ctx, user.Email)
	if existingUser != nil {
		return fmt.Errorf("user with this email already exists")
	}

	existingUser, _ = u.userRepo.GetByUsername(ctx, user.Username)
	if existingUser != nil {
		return fmt.Errorf("user with this username already exists")
	}

	hashedPassword, err := u.jwt.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.Password = hashedPassword
	user.IsActive = true
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	// Assign default role if not provided
	if user.RoleID == "" {
		// TODO: Define a default role or handle this case
		// For now, we assume the caller might set it or we leave it empty (if allowed)
	} else {
		// Validate role
		if _, err := u.roleRepo.GetByID(ctx, user.RoleID); err != nil {
			return fmt.Errorf("invalid role id: %w", err)
		}
	}

	if err := u.userRepo.Create(ctx, user); err != nil {
		return err
	}
	return nil
}

func (u *userUsecase) GetUser(ctx context.Context, id string) (*domain.User, error) {
	return u.userRepo.GetByID(ctx, id)
}

func (u *userUsecase) ListUsers(ctx context.Context, filter domain.UserFilter) ([]*domain.User, int64, error) {
	return u.userRepo.List(ctx, filter)
}

func (u *userUsecase) UpdateUser(ctx context.Context, user *domain.User) error {
	existingUser, err := u.userRepo.GetByID(ctx, user.ID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if user.Email != existingUser.Email {
		emailUser, _ := u.userRepo.GetByEmail(ctx, user.Email)
		if emailUser != nil && emailUser.ID != user.ID {
			return fmt.Errorf("email already in use")
		}
	}

	if user.Username != existingUser.Username {
		usernameUser, _ := u.userRepo.GetByUsername(ctx, user.Username)
		if usernameUser != nil && usernameUser.ID != user.ID {
			return fmt.Errorf("username already in use")
		}
	}

	if user.RoleID != "" && user.RoleID != existingUser.RoleID {
		if _, err := u.roleRepo.GetByID(ctx, user.RoleID); err != nil {
			return fmt.Errorf("invalid role id: %w", err)
		}
	}

	user.UpdatedAt = time.Now()
	if err := u.userRepo.Update(ctx, user); err != nil {
		return err
	}

	return nil
}

func (u *userUsecase) DeleteUser(ctx context.Context, id string) error {
	_, err := u.userRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if err := u.userRepo.Delete(ctx, id); err != nil {
		return err
	}

	return nil
}

func (u *userUsecase) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	user, err := u.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if err := u.jwt.CheckPassword(user.Password, oldPassword); err != nil {
		return fmt.Errorf("invalid old password")
	}

	hashedPassword, err := u.jwt.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := u.userRepo.UpdatePassword(ctx, userID, hashedPassword); err != nil {
		return err
	}

	return nil
}

func (u *userUsecase) ResetPassword(ctx context.Context, userID, newPassword string) error {
	_, err := u.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	hashedPassword, err := u.jwt.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := u.userRepo.UpdatePassword(ctx, userID, hashedPassword); err != nil {
		return err
	}

	return nil
}

func (u *userUsecase) UpdateUserSettings(ctx context.Context, userID string, settings domain.UserSettings) error {
	return u.userRepo.UpdateSettings(ctx, userID, settings)
}

func (u *userUsecase) ImportUsersFromExcel(ctx context.Context, filePath string) error {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	rows, err := f.GetRows("Sheet1")
	if err != nil {
		return fmt.Errorf("failed to read rows: %w", err)
	}

	var users []*domain.User
	for i, row := range rows {
		if i == 0 {
			continue
		}

		if len(row) < 4 {
			continue
		}

		hashedPassword, _ := u.jwt.HashPassword(row[3])

		user := &domain.User{
			Username:  row[0],
			Email:     row[1],
			FirstName: row[2],
			Password:  hashedPassword,
			IsActive:  true,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		users = append(users, user)
	}

	if len(users) > 0 {
		if err := u.userRepo.CreateBatch(ctx, users); err != nil {
			return fmt.Errorf("failed to import users: %w", err)
		}
	}

	return nil
}

func (u *userUsecase) ExportUsersToExcel(ctx context.Context) (*excelize.File, string, error) {
	users, _, err := u.userRepo.List(ctx, domain.UserFilter{Page: 1, PageSize: 10000})
	if err != nil {
		return nil, "", fmt.Errorf("failed to get users: %w", err)
	}

	f := excelize.NewFile()
	sheetName := "Users"
	index, _ := f.NewSheet(sheetName)

	headers := []string{"Username", "Email", "First Name", "Last Name", "Role", "Active", "Created At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
	}

	for i, user := range users {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), user.Username)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), user.Email)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), user.FirstName)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), user.LastName)
		if user.Role != nil {
			f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), user.Role.Name)
		}
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), user.IsActive)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), user.CreatedAt.Format("2006-01-02 15:04:05"))
	}

	f.SetActiveSheet(index)
	fileName := fmt.Sprintf("users_export_%s.xlsx", fmt.Sprintf("%d", len(users)))

	return f, fileName, nil
}
