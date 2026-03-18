# Stage 1: Build the application
FROM golang:1.21-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy go.mod and go.sum to download dependencies first
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the application
# -o /app/main: specifies the output file name and location.
# -ldflags "-w -s": strips debug information, reducing the binary size.
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/main -ldflags "-w -s" ./main.go

# Stage 2: Create the final image
FROM alpine:latest

# Set the working directory
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /app/main .

# Copy the configuration file
# We will need to create this file locally as well.
COPY config.yml .

# Expose the port the application runs on
EXPOSE 8080

# Command to run the application
CMD ["./main"]
