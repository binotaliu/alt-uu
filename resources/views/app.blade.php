<!DOCTYPE html>
<html
    lang="{{ str_replace('_', '-', app()->getLocale()) }}"
    @class ([
        'dark' => ($appearance ?? 'system') === 'dark',
        'device-android' => \Native\Mobile\Facades\System::isAndroid(),
    ])
>
<head>
    <meta charset="utf-8" />
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <meta name="csrf-token" content="{{ csrf_token() }}" />

    <script>
        (function () {
            window.appearance = '{{ $appearance ?? "system" }}';
            window.showOnboarding = {{ $showOnboarding ? 'true' : 'false' }};
            if (window.appearance === 'system') {
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                }
            } else if (window.appearance === 'light') {
                document.documentElement.classList.remove('dark');
            }
            // appearance === 'dark' is already set via @class directive on <html>

            const maybeChangeScheme = (newScheme) => {
                if (window.appearance !== 'system') {
                    return;
                }
                if (newScheme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            };

            // watch for changes in system preference if appearance is set to 'system'
            window
                .matchMedia('(prefers-color-scheme: dark)')
                .addEventListener('change', (e) => {
                    maybeChangeScheme(e.matches ? 'dark' : 'light');
                });

            // also watch when app focus / visibility changes, in case user changes system theme while app is in background
            window.addEventListener('focus', () => {
                if (document.visibilityState === 'visible') {
                    const newScheme = window.matchMedia('(prefers-color-scheme: dark)')
                        .matches
                        ? 'dark'
                        : 'light';
                    maybeChangeScheme(newScheme);
                }
            });
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    const newScheme = window.matchMedia('(prefers-color-scheme: dark)')
                        .matches
                        ? 'dark'
                        : 'light';
                    maybeChangeScheme(newScheme);
                }
            });
        })();
    </script>

    <style>
        html,
        body {
            touch-action: manipulation;
            -ms-touch-action: manipulation;
        }
        html {
            background-color: oklch(1 0 0);
        }
        html.dark {
            background-color: oklch(0.145 0 0);
        }
    </style>

    <title>{{ config('app.name', 'Alt UU') }}</title>

    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

    @if (config('app.debug'))
        <script>
            (function () {
                const createOverlay = (msg) => {
                    let overlay = document.getElementById('js-error-overlay');
                    if (!overlay) {
                        overlay = document.createElement('div');
                        overlay.id = 'js-error-overlay';
                        overlay.style =
                            'position:fixed;margin-top:var(--inset-top,3rem);top:1rem;right:1rem;max-width:420px;z-index:99999;padding:1rem 1.25rem;border-radius:0.5rem;background:rgba(0,0,0,0.85);color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.5);';
                        overlay.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
                <strong style="font-size:0.95rem;">JS Error</strong>
                <button id="js-error-overlay-close" style="background:transparent;border:none;color:inherit;font-size:1.1rem;cursor:pointer;opacity:0.7;">✕</button>
                </div>
                <pre id="js-error-overlay-msg" style="margin-top:0.75rem;font-size:0.8rem;white-space:pre-wrap;word-break:break-word;"></pre>
            `;
                        document.body.appendChild(overlay);
                        overlay.querySelector(
                            '#js-error-overlay-close',
                        ).onclick = () => overlay.remove();
                    }

                    const msgEl = overlay.querySelector(
                        '#js-error-overlay-msg',
                    );
                    msgEl.textContent = msg;
                };

                window.addEventListener('error', (event) => {
                    const { message, filename, lineno, colno, error } = event;
                    const stack = error?.stack ? `\n${error.stack}` : '';
                    createOverlay(
                        `${message}\n${filename}:${lineno}:${colno}${stack}`,
                    );
                });

                window.addEventListener('unhandledrejection', (event) => {
                    const reason = event.reason;
                    const text =
                        typeof reason === 'string'
                            ? reason
                            : reason?.stack || JSON.stringify(reason, null, 2);
                    createOverlay(`UnhandledPromiseRejection:\n${text}`);
                });
            })();
        </script>
    @endif

    @vite (['resources/css/app.css', 'resources/js/app.ts'])
</head>
<body
    @class ([
        'overflow-x-hidden bg-warm-100 font-sans antialiased dark:bg-zinc-950' => true,
        'device-android' => \Native\Mobile\Facades\System::isAndroid(),
        'device-ios' => \Native\Mobile\Facades\System::isIos(),
    ])
>
    <div id="app"></div>

    @if (config('app.debug') && ! \Native\Mobile\Facades\System::isIos() && ! \Native\Mobile\Facades\System::isAndroid())
        <div
            class="fixed right-4 bottom-4 z-50 rounded bg-white px-2 py-4 opacity-70 transition-opacity hover:opacity-100"
            style="display: none"
        >
            <div class="w-48 space-y-1 rounded border border-zinc-500 p-2">
                <label class="flex items-center gap-2 text-xs">
                    <input
                        type="radio"
                        name="simulation"
                        value="none"
                        checked
                        class="simulation-radio"
                    />
                    無模擬
                </label>
                <label class="flex items-center gap-2 text-xs">
                    <input
                        type="radio"
                        name="simulation"
                        value="notch"
                        class="simulation-radio"
                    />
                    瀏海
                </label>
                <label class="flex items-center gap-2 text-xs">
                    <input
                        type="radio"
                        name="simulation"
                        value="dynamic-island"
                        class="simulation-radio"
                    />
                    動態島
                </label>
                <label class="flex items-center gap-2 text-xs">
                    <input
                        type="radio"
                        name="simulation"
                        value="ipad-window-control"
                        class="simulation-radio"
                    />
                    視窗控制
                </label>
                <label class="flex items-center gap-2 text-xs">
                    <input
                        type="radio"
                        name="simulation"
                        value="ipad-window-control-with-topbar"
                        class="simulation-radio"
                    />
                    視窗控制 + Menu
                </label>

                <button
                    id="close"
                    onclick="this.parentElement.parentElement.remove()"
                    class="absolute top-1 right-1 text-xs text-zinc-500 transition-opacity hover:text-zinc-700"
                >
                    ✕
                </button>
            </div>
        </div>
        <div
            id="notch"
            class="notch-simulation pointer-events-none fixed top-0 left-1/2 hidden h-12 w-full max-w-md -translate-x-1/2 transform rounded-b-4xl bg-black"
        ></div>
        <div
            id="dynamic-island"
            class="notch-simulation pointer-events-none fixed top-0 left-1/2 hidden h-12 w-full max-w-sm -translate-x-1/2 transform rounded-full bg-black"
        ></div>
        <div
            id="ipad-window-control"
            class="ipad-window-control-simulation fixed top-3 left-4 flex hidden h-6 w-18 items-center justify-center gap-1 rounded-full bg-white px-2 transition hover:scale-200"
        >
            <span class="h-3 w-3 rounded-full bg-red-500"></span>
            <span class="h-3 w-3 rounded-full bg-yellow-500"></span>
            <span class="h-3 w-3 rounded-full bg-green-500"></span>
        </div>
        <div
            id="ipad-window-control-with-top-bar"
            class="ipad-window-control-with-top-bar-simulation fixed top-11 left-4 flex hidden h-6 w-18 items-center justify-center gap-1 rounded-full bg-white px-2 transition hover:scale-200"
        >
            <span class="h-3 w-3 rounded-full bg-red-500"></span>
            <span class="h-3 w-3 rounded-full bg-yellow-500"></span>
            <span class="h-3 w-3 rounded-full bg-green-500"></span>
        </div>
        <div
            id="ipad-top-bar"
            class="ipad-window-control-with-top-bar-simulation pointer-events-none fixed top-0 left-0 hidden h-8 w-full bg-gray-200 dark:bg-gray-800"
        ></div>
        <script>
            (function () {
                const radios = document.querySelectorAll('.simulation-radio');

                const updateSimulation = (value) => {
                    document
                        .querySelectorAll('.notch-simulation')
                        .forEach((el) => el.classList.add('hidden'));
                    document
                        .querySelectorAll('.ipad-window-control-simulation')
                        .forEach((el) => el.classList.add('hidden'));
                    document
                        .querySelectorAll(
                            '.ipad-window-control-with-top-bar-simulation',
                        )
                        .forEach((el) => el.classList.add('hidden'));
                    document
                        .getElementById('ipad-top-bar')
                        .classList.add('hidden');

                    const cssVariables = {
                        'inset-top': '0px',
                        'corner-inset-left': '0px',
                    };

                    switch (value) {
                        case 'notch':
                            document
                                .getElementById('notch')
                                .classList.remove('hidden');
                            cssVariables['inset-top'] = '3rem';
                            break;
                        case 'dynamic-island':
                            document
                                .getElementById('dynamic-island')
                                .classList.remove('hidden');
                            cssVariables['inset-top'] = '3rem';
                            break;
                        case 'ipad-window-control':
                            document
                                .getElementById('ipad-window-control')
                                .classList.remove('hidden');
                            cssVariables['corner-inset-left'] = '5rem';
                            break;
                        case 'ipad-window-control-with-topbar':
                            document
                                .getElementById(
                                    'ipad-window-control-with-top-bar',
                                )
                                .classList.remove('hidden');
                            document
                                .getElementById('ipad-top-bar')
                                .classList.remove('hidden');
                            cssVariables['inset-top'] = '2rem';
                            cssVariables['corner-inset-left'] = '5rem';
                            break;
                    }

                    for (const [key, value] of Object.entries(cssVariables)) {
                        document.documentElement.style.setProperty(
                            `--${key}`,
                            value,
                        );
                    }
                };

                radios.forEach((radio) => {
                    radio.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            updateSimulation(e.target.value);
                        }
                    });
                });
            })();
        </script>
    @endif
</body>
</html>
