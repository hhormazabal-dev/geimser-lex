#!/bin/bash

# LEXSER Test Runner Script
# This script runs the complete test suite for the LEXSER application

set -e  # Exit on any error

echo "🚀 Starting LEXSER Test Suite"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_environment() {
    print_status "Checking environment variables..."
    
    required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Please set these variables in your .env.local file or environment"
        exit 1
    fi
    
    print_success "Environment variables are set"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    else
        print_status "Dependencies already installed, checking for updates..."
        npm ci
    fi
    
    # Install Playwright browsers if not already installed
    if [ ! -d "node_modules/@playwright/test" ]; then
        print_status "Installing Playwright..."
        npm install @playwright/test
    fi
    
    print_status "Installing Playwright browsers..."
    npx playwright install
    
    print_success "Dependencies installed"
}

# Run linting
run_linting() {
    print_status "Running ESLint..."
    
    if npm run lint; then
        print_success "Linting passed"
    else
        print_error "Linting failed"
        exit 1
    fi
}

# Run type checking
run_type_check() {
    print_status "Running TypeScript type checking..."
    
    if npm run type-check; then
        print_success "Type checking passed"
    else
        print_error "Type checking failed"
        exit 1
    fi
}

# Build the application
build_application() {
    print_status "Building application..."
    
    if npm run build; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Run unit tests
run_unit_tests() {
    print_status "Running unit tests with Vitest..."
    
    if npm run test:unit; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        exit 1
    fi
}

# Start development server for E2E tests
start_dev_server() {
    print_status "Starting development server for E2E tests..."
    
    # Start the dev server in the background
    npm run dev &
    DEV_SERVER_PID=$!
    
    # Wait for server to be ready
    print_status "Waiting for server to be ready..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            print_success "Development server is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
        print_status "Waiting for server... (attempt $attempt/$max_attempts)"
    done
    
    print_error "Development server failed to start within timeout"
    kill $DEV_SERVER_PID 2>/dev/null || true
    exit 1
}

# Stop development server
stop_dev_server() {
    if [ ! -z "$DEV_SERVER_PID" ]; then
        print_status "Stopping development server..."
        kill $DEV_SERVER_PID 2>/dev/null || true
        wait $DEV_SERVER_PID 2>/dev/null || true
        print_success "Development server stopped"
    fi
}

# Run E2E tests
run_e2e_tests() {
    print_status "Running E2E tests with Playwright..."
    
    # Create auth-states directory if it doesn't exist
    mkdir -p tests/auth-states
    
    if npx playwright test; then
        print_success "E2E tests passed"
    else
        print_error "E2E tests failed"
        
        # Generate test report
        print_status "Generating test report..."
        npx playwright show-report --host=0.0.0.0 --port=9323 &
        REPORT_PID=$!
        
        print_warning "Test report available at: http://localhost:9323"
        print_warning "Press Ctrl+C to continue..."
        
        # Wait for user input or timeout
        read -t 30 -p "Press Enter to continue or wait 30 seconds..." || true
        
        kill $REPORT_PID 2>/dev/null || true
        
        exit 1
    fi
}

# Generate test coverage report
generate_coverage() {
    print_status "Generating test coverage report..."
    
    if npm run test:coverage; then
        print_success "Coverage report generated"
        print_status "Coverage report available in coverage/ directory"
    else
        print_warning "Coverage report generation failed"
    fi
}

# Run security audit
run_security_audit() {
    print_status "Running security audit..."
    
    if npm audit --audit-level=moderate; then
        print_success "Security audit passed"
    else
        print_warning "Security audit found issues"
        print_status "Run 'npm audit fix' to fix automatically fixable issues"
    fi
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    stop_dev_server
    
    # Kill any remaining processes
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "playwright" 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    echo "Starting test execution at $(date)"
    echo ""
    
    # Parse command line arguments
    RUN_UNIT=true
    RUN_E2E=true
    RUN_LINT=true
    RUN_BUILD=true
    RUN_COVERAGE=false
    RUN_AUDIT=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                RUN_E2E=false
                shift
                ;;
            --e2e-only)
                RUN_UNIT=false
                RUN_LINT=false
                RUN_BUILD=false
                shift
                ;;
            --no-lint)
                RUN_LINT=false
                shift
                ;;
            --no-build)
                RUN_BUILD=false
                shift
                ;;
            --coverage)
                RUN_COVERAGE=true
                shift
                ;;
            --audit)
                RUN_AUDIT=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --unit-only    Run only unit tests"
                echo "  --e2e-only     Run only E2E tests"
                echo "  --no-lint      Skip linting"
                echo "  --no-build     Skip build step"
                echo "  --coverage     Generate coverage report"
                echo "  --audit        Run security audit"
                echo "  --help         Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Execute test steps
    check_environment
    install_dependencies
    
    if [ "$RUN_AUDIT" = true ]; then
        run_security_audit
    fi
    
    if [ "$RUN_LINT" = true ]; then
        run_linting
        run_type_check
    fi
    
    if [ "$RUN_BUILD" = true ]; then
        build_application
    fi
    
    if [ "$RUN_UNIT" = true ]; then
        run_unit_tests
    fi
    
    if [ "$RUN_COVERAGE" = true ]; then
        generate_coverage
    fi
    
    if [ "$RUN_E2E" = true ]; then
        start_dev_server
        run_e2e_tests
        stop_dev_server
    fi
    
    echo ""
    print_success "🎉 All tests completed successfully!"
    echo "Test execution completed at $(date)"
}

# Run main function
main "$@"
