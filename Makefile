.PHONY: help prepare run-i watch-i release-i run-a watch-a release-a reset-nativephp ensure-nativephp ensure-node-modules ensure-composer-dev-deps

SHELL := /bin/zsh

NPM := npm
COMPOSER := composer
ARTISAN := php artisan
CONCURRENTLY := npx concurrently

UUID ?=

# App Store releases must be built with stable Xcode, never Xcode-beta (which
# may be selected via xcode-select for testing against beta iOS devices).
STABLE_DEVELOPER_DIR := /Applications/Xcode.app/Contents/Developer

help:
	@echo "Usage: make <target> [UUID=<uuid>]"
	@echo ""
	@echo "Targets:"
	@echo "  help                  Show this help message"
	@echo "  prepare               Prepare the environment (install dependencies)"
	@echo "  run-i                 Run the iOS app on a device or simulator"
	@echo "  watch-i               Run the iOS app in watch mode (auto-rebuild on changes)"
	@echo "  release-i             Build and package the iOS app for release"
	@echo "  run-a                 Run the Android app on a device or emulator"
	@echo "  watch-a               Run the Android app in watch mode (auto-rebuild on changes)"
	@echo "  release-a             Build and package the Android app for release"
	@echo "  reset-nativephp       Reset the nativephp directory (removes and reinstalls)"
	@echo ""

reset-nativephp:
	@rm -Rf nativephp/ios && rm -Rf nativephp/android
	@make ensure-nativephp

ensure-nativephp:
	@if [ ! -d "nativephp/ios" ] || [ ! -d "nativephp/android" ]; then $(ARTISAN) native:install --force both; fi

ensure-node-modules:
	@if [ ! -d "node_modules" ]; then $(NPM) install; fi

ensure-composer-dev-deps:
	$(COMPOSER) install

prepare:
	@$(CONCURRENTLY) "$(NPM) install" "$(COMPOSER) install" --names "npm,composer" --prefix-colors "blue,green"
	if [ -d "nativephp" ]; then rm -Rf nativephp; fi
	$(ARTISAN) native:install --force both

run-i:
	@if [ -z "$(UUID)" ]; then echo "UUID is required. use make run UUID=<uuid>"; exit 1; fi
	@$(CONCURRENTLY) "$(MAKE) ensure-composer-dev-deps && $(MAKE) ensure-nativephp" "$(MAKE) ensure-node-modules" --names "php,node" --prefix-colors "green,blue"
	@$(CONCURRENTLY) "$(NPM) run build -- --mode=ios && rm -Rf node_modules" "$(COMPOSER) install --no-dev" --names "npm,composer" --prefix-colors "blue,green"
	$(ARTISAN) native:run i $(UUID)
	@$(CONCURRENTLY) "$(MAKE) ensure-node-modules" "$(MAKE) ensure-composer-dev-deps" --names "npm,composer" --prefix-colors "blue,green"

watch-i:
	@if [ -z "$(UUID)" ]; then echo "UUID is required. use make watch UUID=<uuid>"; exit 1; fi
	@$(CONCURRENTLY) "$(MAKE) ensure-composer-dev-deps && $(MAKE) ensure-nativephp" "$(MAKE) ensure-node-modules" --names "php,node" --prefix-colors "green,blue"
	$(NPM) install && $(NPM) run build -- --mode=ios
	$(ARTISAN) native:run i $(UUID) --watch

release-i: export DEVELOPER_DIR := $(STABLE_DEVELOPER_DIR)
release-i:
	$(MAKE) ensure-composer-dev-deps
	$(MAKE) reset-nativephp
	$(MAKE) ensure-node-modules
	$(CONCURRENTLY) "$(NPM) run build -- --mode=ios && rm -Rf node_modules" "$(COMPOSER) install --no-dev" --names "npm,composer" --prefix-colors "blue,green"
	$(ARTISAN) native:package ios --upload-to-app-store --rebuild
	$(CONCURRENTLY) "$(NPM) install" "$(COMPOSER) install" --names "npm,composer" --prefix-colors "blue,green"

run-a:
	$(MAKE) ensure-composer-dev-deps && $(MAKE) ensure-nativephp
	$(MAKE) ensure-node-modules
	$(NPM) run build -- --mode=android && rm -Rf node_modules
	$(ARTISAN) native:run android $(UUID)
	$(MAKE) ensure-node-modules && $(MAKE) ensure-composer-dev-deps

watch-a:
	$(MAKE) ensure-composer-dev-deps && $(MAKE) ensure-nativephp
	$(MAKE) ensure-node-modules
	$(NPM) run build -- --mode=android
	$(ARTISAN) native:run android $(UUID) --watch

release-a:
	$(MAKE) ensure-composer-dev-deps
	$(MAKE) reset-nativephp
	$(MAKE) ensure-node-modules
	$(CONCURRENTLY) "$(NPM) run build -- --mode=android && rm -Rf node_modules" "$(COMPOSER) install --no-dev" --names "npm,composer" --prefix-colors "blue,green"
	$(ARTISAN) native:package android --build-type=bundle --upload-to-play-store --rebuild
	$(CONCURRENTLY) "$(NPM) install" "$(COMPOSER) install" --names "npm,composer" --prefix-colors "blue,green"

