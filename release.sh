#!/bin/bash

get_current_version() {
    local package_json=$1
    if [ -f "$package_json" ]; then
        grep '"version":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found at $package_json"
        exit 1
    fi
}

get_package_name() {
    local package_json=$1
    if [ -f "$package_json" ]; then
        grep '"name":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found at $package_json"
        exit 1
    fi
}

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

if [ -n "$(git status --porcelain)" ]; then
    echo "Error: There are uncommitted changes in the working directory"
    echo "Please commit or stash these changes before proceeding"
    exit 1
fi

git pull

echo "Starting package version management..."

root_package_json="packages/react/package.json"
current_version=$(get_current_version "$root_package_json")
echo ""
echo "Current version: $current_version"
echo ""

read -p "Update version? (patch/minor/major): " version_type
echo ""

for package_dir in packages/*; do
    if [ -d "$package_dir" ]; then
        echo "Updating version for $package_dir"

        cd $package_dir

        update_version "$package_dir" "$version_type"

        cd ../..

        echo ""
    fi
done

new_version=$(get_current_version "$root_package_json")

echo "Updating lock file..."
pnpm i
echo ""

echo "Staging package.json files..."
git add "**/package.json"
echo ""

echo "Committing version changes..."
git commit -m "v$new_version"
echo ""

echo "Creating git tag: v$new_version"
git tag "v$new_version"
git push --tags
echo ""

echo "Running release process..."
echo ""

for package_dir in packages/*; do
    if [ -d "$package_dir" ]; then
        echo "Releasing $package_dir"
        cd $package_dir
        pnpm run release
        cd ../..
        echo ""
    fi
done

echo "Released!"

echo ""

echo "Release on GitHub:"
echo "https://github.com/laravel/stream/releases/tag/v$new_version"

open "https://github.com/laravel/stream/releases/tag/v$new_version"
