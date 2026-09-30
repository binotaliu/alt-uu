<?php

declare(strict_types=1);

namespace AltUU\HtmlView\Elements;

use Native\Mobile\Edge\CallbackRegistry;
use Native\Mobile\Edge\Element;

/**
 * `<native:html-view>`: a sandboxed WKWebView / Android WebView for foreign
 * (school-authored) HTML that, unlike the stock `native:webview`, can size
 * itself to its content, intercept link taps before navigation and pass
 * messages from the page to PHP.
 *
 * Wire type: `html_view`. Props (only non-default values are emitted):
 *  - `src`               https/http URL to load (mutually exclusive with `html`)
 *  - `html`              inline document, loaded with `base_url` (default: opaque origin)
 *  - `base_url`          base URL for `html`
 *  - `javascript`        bool, default false (page scripts); also gates the message bridge
 *  - `dom_storage`       bool, default false
 *  - `auto_height`       bool, default false: the view reports and adopts its content height
 *  - `estimated_height`  float (dp/pt), height used until the first measurement, default 80
 *  - `color_scheme`      `light` | `dark` (default: follow the device)
 *  - `font_scale`        float 0.5..3.0, default 1.0 (native text zoom)
 *  - `user_script`       string injected at document start into the page (needs `javascript`)
 *  - `on_link_tap`       callback id, text = JSON `{"url","scheme","newWindow"}`
 *  - `on_height_change`  callback id, text = content height as a decimal string
 *  - `on_message`        callback id, text = the string the page passed to `AltUUBridge.postMessage`
 *
 * The three events are delivered as text (the only event payload the EDGE
 * wire format carries) and are bound with plain method-name attributes,
 * because custom `@name=` directives are reserved for child components:
 *
 *     <native:html-view :html="$doc" auto-height on-link-tap="onLinkTap" on-height-change="onHeight" />
 */
final class HtmlView extends Element
{
    public const float FONT_SCALE_MIN = 0.5;

    public const float FONT_SCALE_MAX = 3.0;

    public const array COLOR_SCHEMES = ['light', 'dark'];

    protected string $type = 'html_view';

    /** @var array<string, mixed> */
    protected array $viewProps = [];

    /** @var array<string, string> */
    protected array $callbackMethods = [];

    public static function make(): static
    {
        return new self;
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    public function applyAttributes(array $attrs): void
    {
        foreach (['src', 'html', 'base_url', 'user_script'] as $prop) {
            $value = $this->attribute($attrs, $prop);

            if ($value !== null && $value !== '') {
                $this->viewProps[$prop] = (string) $value;
            }
        }

        foreach (['javascript' => ['javascript', 'js'], 'dom_storage' => ['dom_storage'], 'auto_height' => ['auto_height']] as $prop => $names) {
            foreach ($names as $name) {
                $value = $this->attribute($attrs, $name);

                if ($value !== null) {
                    $this->viewProps[$prop] = filter_var($value === '' ? true : $value, FILTER_VALIDATE_BOOLEAN);
                    break;
                }
            }
        }

        $estimated = $this->attribute($attrs, 'estimated_height');

        if (is_numeric($estimated)) {
            $this->viewProps['estimated_height'] = max(1.0, (float) $estimated);
        }

        $scheme = $this->attribute($attrs, 'color_scheme');

        if (is_string($scheme) && in_array($scheme, self::COLOR_SCHEMES, true)) {
            $this->viewProps['color_scheme'] = $scheme;
        }

        $scale = $this->attribute($attrs, 'font_scale');

        if (is_numeric($scale) && (float) $scale !== 1.0) {
            $this->viewProps['font_scale'] = max(self::FONT_SCALE_MIN, min(self::FONT_SCALE_MAX, (float) $scale));
        }

        foreach (['on_link_tap', 'on_height_change', 'on_message'] as $callback) {
            $method = $this->attribute($attrs, $callback);

            if (is_string($method) && $method !== '') {
                $this->callbackMethods[$callback] = $method;
            }
        }

        $this->applyA11yAttributes($attrs);
    }

    /**
     * @return array<string, mixed>
     */
    protected function resolveProps(CallbackRegistry $registry): array
    {
        $props = $this->viewProps;

        foreach ($this->callbackMethods as $prop => $method) {
            $props[$prop] = $registry->register($method);
        }

        return $props;
    }

    /**
     * Reads an attribute by its snake_case name, accepting the kebab-case and
     * camelCase spellings Blade authors use (`auto-height`, `autoHeight`).
     *
     * @param  array<string, mixed>  $attrs
     */
    private function attribute(array $attrs, string $snake): mixed
    {
        $kebab = str_replace('_', '-', $snake);
        $camel = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $snake))));

        foreach ([$snake, $kebab, $camel] as $key) {
            if (array_key_exists($key, $attrs)) {
                return $attrs[$key];
            }
        }

        return null;
    }
}
