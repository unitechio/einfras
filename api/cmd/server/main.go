package main

import (
	"log"

	"einfra/api/internal/app"
)

func main() {
	if err := app.RunMain(); err != nil {
		log.Fatalf("server runtime failed: %v", err)
	}
}
