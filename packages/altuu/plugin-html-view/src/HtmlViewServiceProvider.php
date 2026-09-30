<?php

declare(strict_types=1);

namespace AltUU\HtmlView;

use Illuminate\Support\ServiceProvider;

/**
 * The `html_view` element and its `<native:html-view>` Blade tag are
 * registered by the core NativeServiceProvider from this plugin's manifest
 * (`components`), so there is nothing to bind here.
 */
final class HtmlViewServiceProvider extends ServiceProvider {}
