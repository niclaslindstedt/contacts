.PHONY: build test lint fmt fmt-check actionlint release clean docs website website-dev install icons check-seo changelog bump native-install native-bundle native-typecheck native-prebuild

build:
	npm run build

test:
	npm test

lint:
	npm run lint

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

release:
	npm run build

clean:
	rm -rf dist node_modules

install:
	npm install

# Regenerate the PWA install icons + the Open Graph image from the app mark.
icons:
	npm run icons

actionlint:
	actionlint -color

docs:
	@echo "see docs/"

# The app IS the website: pages.yml builds it with the Pages base path and
# deploys dist/. These targets mirror that for local inspection.
website:
	VITE_BASE=/contacts/ npm run build

website-dev:
	npm run dev

check-seo:
	npm run build && npm run check:seo

# Local preview of what the Release workflow will write to CHANGELOG.md.
# Pass the planned version: `make changelog VERSION=0.2.0`. Consumes the
# fragments in .changes/unreleased/ — run inside a scratch branch or
# revert afterwards if you only wanted a preview.
changelog:
	@test -n "$(VERSION)" || { \
		echo "usage: make changelog VERSION=X.Y.Z"; exit 2; \
	}
	node scripts/release/collate-changelog.mjs $(VERSION)

# Print the semver bump (patch/minor/major) the Release workflow will
# auto-derive from the current .changes/unreleased/ fragments. Read-only
# — touches nothing.
bump:
	@node scripts/release/compute-bump.mjs

# --- the native wrapper (native/) -------------------------------------------
#
# A thin Expo/React Native shell that bundles this web app and serves it in a
# WebView, plus the iCloud Drive storage backend. It has its OWN dependency
# tree — `make install` at the root does not touch it — so every target here
# reaches in with `--prefix`. Release builds run on EAS and are triggered by
# dispatching .github/workflows/native.yml; see native/RELEASING.md.

native-install:
	npm --prefix native install

# Build the web app and pack it into native/assets/webroot.zip — the copy the
# wrapper serves. Required before any native build; CI does it for you.
native-bundle:
	npm --prefix native run bundle

native-typecheck:
	npm --prefix native run typecheck

# Regenerate native/ios and native/android from app.config.js and the config
# plugin. Both are gitignored build output — this is only for inspecting what
# the plugin produces.
native-prebuild:
	npm --prefix native run prebuild
