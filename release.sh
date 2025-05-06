#!/bin/bash

# Function to get current version from package.json
get_current_version() {
    local package_json=$1
    if [ -f "$package_json" ]; then
        grep '"version":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found at $package_json"
        exit 1
    fi
}

# Function to get package name from package.json
get_package_name() {
    local package_json=$1
    if [ -f "$package_json" ]; then
        grep '"name":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found at $package_json"
        exit 1
    fi
}

# Function to update version
update_version() {
    local package_dir=$1
    local version_type=$2

    case $version_type in
        "patch")
            pnpm version patch --no-git-tag-version
            ;;
        "minor")
            pnpm version minor --no-git-tag-version
            ;;
        "major")
            pnpm version major --no-git-tag-version
            ;;
        *)
            echo "Invalid version type. Please choose patch/minor/major"
            exit 1
            ;;
    esac
}

# Main script
echo "Starting package version management..."

# Get root package version
root_package_json="packages/react/package.json"
current_version=$(get_current_version "$root_package_json")
echo ""
echo "Current version: $current_version"
echo ""

# Get version type once
read -p "Update version? (patch/minor/major): " version_type
echo ""

# Iterate through packages directory
for package_dir in packages/*; do
    if [ -d "$package_dir" ]; then
        echo "Updating version for $package_dir"

        cd $package_dir

        # Update version
        update_version "$package_dir" "$version_type"

        cd ../..

        echo ""
    fi
done

# Get new version from root package
new_version=$(get_current_version "$root_package_json")

# Install dependencies
echo "Updating lock file..."
pnpm i
echo ""

# Create single git tag
echo "Creating git tag: v$new_version"
git tag "v$new_version"
echo ""

echo "Running release process..."
echo ""
pnpm -r run release

echo "Released!"
