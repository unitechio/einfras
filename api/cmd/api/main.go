package main

import (
	"log"

	"einfra/api/internal/app"
)

func main() {
	if err := app.RunMain(); err != nil {
		log.Fatalf("api runtime failed: %v", err)
	}
}
