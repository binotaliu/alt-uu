<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Diagnostic recording
    |--------------------------------------------------------------------------
    |
    | Build-level master switch. Recording additionally requires the user to
    | have switched it on in Settings, so turning this off compiles the
    | feature out entirely rather than merely defaulting it off.
    |
    */

    'enabled' => (bool) env('DIAGNOSTICS_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Recording window
    |--------------------------------------------------------------------------
    |
    | Recording is OFF by default and switches itself back off this many
    | minutes after the user turns it on. Writing a row per request costs
    | SQLite writes on the device, which is a real cost on a low-end Android
    | phone, so the user opts in for a bounded window while reproducing a
    | problem rather than paying for it permanently.
    |
    | Enforced by comparing the stored expiry against the clock, so nothing
    | has to be scheduled — which matters, because there is no scheduler
    | running on a device.
    |
    */

    'recording_window_minutes' => (int) env('DIAGNOSTICS_RECORDING_WINDOW_MINUTES', 30),

    /*
    |--------------------------------------------------------------------------
    | Retention
    |--------------------------------------------------------------------------
    |
    | Rows older than this are discarded. The ring buffer alone does not
    | expire anything: with recording off by default, a log can now sit
    | untouched for months, so age is the bound that matters.
    |
    */

    'retention_days' => (int) env('DIAGNOSTICS_RETENTION_DAYS', 14),

    /*
    |--------------------------------------------------------------------------
    | Ring buffer size
    |--------------------------------------------------------------------------
    |
    | The store is bounded: once it grows past this many rows the oldest are
    | pruned. Keeps the SQLite file small on device.
    |
    */

    'max_events' => (int) env('DIAGNOSTICS_MAX_EVENTS', 500),

    /*
    |--------------------------------------------------------------------------
    | Response body snippet
    |--------------------------------------------------------------------------
    |
    | How many bytes of an upstream response body to keep when a call fails or
    | its JSON cannot be decoded. Snippets are never captured on success.
    |
    */

    'body_snippet_bytes' => (int) env('DIAGNOSTICS_BODY_SNIPPET_BYTES', 2048),

    /*
    |--------------------------------------------------------------------------
    | Material source viewer
    |--------------------------------------------------------------------------
    |
    | How many bytes of a course material's raw source, or of the course
    | directory JSON, the material source tool returns. Unlike the snippet
    | above this is meant to be read whole, so it is far larger; the cap only
    | keeps one oversized page from freezing the WebView.
    |
    */

    'material_source_bytes' => (int) env('DIAGNOSTICS_MATERIAL_SOURCE_BYTES', 204800),

    /*
    |--------------------------------------------------------------------------
    | Expose exception detail to the client
    |--------------------------------------------------------------------------
    |
    | Alt UU is open source, so leaking a PHP stack trace to the user costs us
    | nothing and makes bug reports far more useful. This is deliberately NOT
    | tied to app.debug: production builds ship with APP_DEBUG=false, and
    | Laravel's default handler would otherwise flatten every non-HTTP
    | exception to the useless string "Server Error".
    |
    */

    'expose_exceptions' => (bool) env('DIAGNOSTICS_EXPOSE_EXCEPTIONS', true),

    /*
    |--------------------------------------------------------------------------
    | Native debug log tail
    |--------------------------------------------------------------------------
    |
    | Number of trailing bytes of the NativePHP shell log to fold into an
    | exported bundle. Set to 0 to leave it out.
    |
    */

    'native_log_tail_bytes' => (int) env('DIAGNOSTICS_NATIVE_LOG_TAIL_BYTES', 16384),

];
