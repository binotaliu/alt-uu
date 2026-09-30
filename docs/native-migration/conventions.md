# SuperNative conventions (contract for the native migration)

Sources: `vendor/nativephp/mobile-ui` 0.6.0 (`src/`, `nativephp.json`, `resources/boost/guidelines/core.blade.php`) and `vendor/nativephp/mobile` 4.5.2 (`src/Edge`, `src/Testing`, `src/NativeServiceProvider.php`). When in doubt, trust source over docs. Nearly every failure is silent (dropped class, empty node, late theme push), so assert structure in tests.

## 1. Layout of the app

| Thing                        | Location                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens and child components | `app/NativeComponents/**` (`App\NativeComponents\...`), scaffold with `php artisan native:make Courses/CourseList`                          |
| Screen views                 | `resources/views/native/**` (kebab-cased, subfolders follow namespace: `native.courses.course-list`)                                        |
| Shared partials              | `resources/views/native/partials/*.blade.php`, used with `@include('native.partials.x')`; the parent's public props propagate into includes |
| Layouts                      | `app/NativeLayouts/*` (extend `Native\Mobile\Edge\Layouts\NativeLayout`), proposed namespace `App\NativeLayouts`                            |
| Routes                       | `routes/mobile.php` (auto-loaded, see gotcha 1)                                                                                             |
| Theme, fonts                 | `config/native-ui.php` (`theme.light`, `theme.dark`, `fonts`)                                                                               |
| Icon enums                   | `app/Icons/{Ios,Android,AndroidOutlined}.php` (generated, excluded from arch rules; regenerate with `php artisan native-ui:generate-icons`) |
| Tests                        | `tests/Feature/Native/**` using `Native\Mobile\Testing\Native`                                                                              |

`NativeComponent` classes under `app/NativeComponents` are auto-registered as tags by class basename (`CourseCard` becomes `<native:course-card>`). Registered element names always win over component tags, so never name a component like an element (`Button`, `List`, `Modal`, ...).

## 2. Element catalog (Blade tag = `native:` + kebab of the type)

Core (`nativephp/mobile`, always available):

- Layout: `column`, `row`, `stack`, `scroll-view`, `spacer`, `pressable`, `gesture-area`, `refreshable`, `lazy-grid` (attrs `columns`/`grid-cols-N` class, `gap`, `horizontal`).
- Content: `text` (text via slot; props font, `max-lines`, ...), `image` (`src`, `alt`, `fit`, `tint-color`), `icon`, `divider`.
- Shapes/drawing: `canvas`, `rect`, `circle`, `line`.
- Chrome: `top-bar` (+ `top-bar-action`, `top-bar-title`), `bottom-nav` (+ `bottom-nav-item`), `side-nav` (+ `side-nav-item`/`-group`/`-header`), `fab`, `bottom-bar`.

`nativephp/mobile-ui` (component library; without it every one of these throws "Unknown native element type"):

- Lists: `list` (attrs `separator`, `plain`, `transparent`, `horizontal`, `@refresh`/`on-refresh`, `@endReached`/`on-end-reached`), children `list-section` (`header`, `footer`) and `list-item` (`headline`, `supporting`, `overline`, `leading-icon`, `leading-image`, `leading-avatar`, `trailing-text`, `trailing-icon`, `trailing-switch`, `on-swipe-delete`, ...), `virtual-list` (windowed, `count`, `estimated-row-height`, `@windowChange`), `lazy-grid` (core), `pager` (`count`, `page`, `@pageChange`, windowed), `carousel`, `accordion` (+ `accordion-header`, `accordion-content`).
- Inputs: `outlined-text-input`, `filled-text-input`, `bare-text-input` (label, placeholder, `secure`, `revealable`, `multiline`, `min-lines`, `max-lines`, `max-length`, `keyboard`, `error`/`is-error`, `disabled`, `read-only`, `leading-icon`, `@submit`, `@change`, `@selectionChange`). There is NO `native:text-input` tag in mobile-ui 0.6 (its manifest only registers the three above); do not use it.
  `toggle`, `checkbox`, `slider`, `select` (`options`), `radio-group` + `radio`, `button-group` (`options`), `chip`, `date-picker` (`mode` date|time|datetime, `picker-style`), `tab-row` + `tab`, `button` (`label` or slot, `variant`, `icon`, `loading`, `size`, `disabled`).
- Feedback: `badge` (`count`, `label`, `variant`), `progress-bar` (`value`, `indeterminate`), `activity-indicator`.
- Overlays: `modal` (`visible`, `dismissible`, `@dismiss`), `bottom-sheet` (`visible`, `detents`, `@dismiss`), `sheet-pane`, `native-drawer`, `floating-overlay`, `background-layer`.
- Web content: `native:webview` (NOT `web-view`; type `webview`, self-closing). Attrs: `src` (URL), `html` (inline HTML), `javascript`/`js` (default off), `dom-storage` (default off), `fullscreen`, `php` (embed the app's own Laravel webview; `src` is then an app route), `@navigated="method"` (fires per top-frame URL commit with the URL). Default posture is sandboxed: JS off, no DOM storage, no file access, no new windows. Enable only what a screen needs.

Common: every element accepts `class`, `a11y-label`, `a11y-hint`, `ref`, and `key`. Icon-only controls MUST carry `a11y-label`. Events: `@tap`/`@press`, `@longTap`, `@change`, `@submit`, `@dismiss`, `@refresh`, `@endReached`. Directives interpolate: `@tap="pick({{ $id }})"`.

Icons: `@use('App\Icons\Ios')`, `@use('App\Icons\Android')`, then `<native:icon :ios="Ios::Gearshape" :android="Android::Settings" />`; bars use `:ios-icon`/`:android-icon`. A plain `icon="home"` string is the cross-platform fallback. No emoji.

Data binding: `native:model="prop"` is LIVE by default (opposite of Livewire 3); use `.blur`, `.debounce.300ms`. `updated{Prop}()` fires on change. There is no built-in `validate()`; validate manually and keep `public array $errors`.

## 3. TailwindParser whitelist (`vendor/nativephp/mobile/src/Edge/TailwindParser.php`)

Supported: flex (`flex-row|col`, `flex-1`, `grow`, `shrink-0`, `flex-wrap`), `w-*`/`h-*` (spacing scale, fractions, `full`, arbitrary `[..]`), `min-w|max-w|min-h|max-h-*`, `p*/m*` (all sides, axes), `gap-*`, `items-*`, `justify-*`, `self-*`, `absolute|relative`, `inset-*`, `top|right|bottom|left-*`, `hidden|flex|block`, `grid-cols-N` (on lazy-grid), `aspect-square|video|[..]`, `bg-*` (palette, arbitrary hex, `/NN` opacity), gradients (`bg-linear-to-*` / `bg-gradient-to-*` + `from-|via-|to-`), `bg-theme-* text-theme-* border-theme-*` (with `/NN`), `text-{xs..9xl}`, `text-{color}`, `font-{thin..extrabold}`, `font-sans|serif|mono`, `italic`, `underline`, `line-through`, `uppercase|lowercase|capitalize`, `tracking-*`, `leading-{none..loose}` and `leading-[..]`, `select-text|none`, `border`, `border-*`, `rounded` and `rounded-{sm..3xl,full}` (per-corner `rounded-t|r|b|l|tl|tr|br|bl-*` now parse), `shadow*`, `glow-*`, `blur*`, `opacity-*`, `object-*`, `glass`, `safe-area*`, `dark:` prefix, breakpoint prefixes (`sm medium md expanded lg xl 2xl`), `ios:` / `android:` prefixes.
Not supported (dropped silently): `scale-*`, `rotate-*`, `z-*`, `overflow-*`, `truncate`, logical radii (`rounded-s-*`), `space-x/y-*`, `grid` layout beyond `lazy-grid`. Verify anything doubtful with `TailwindParser::parse('cls')` (empty array means dropped). Colors: palette names, hex, `#RRGGBBAA` (CSS order). Use theme tokens for every role; arbitrary hex only for data-driven colors from one PHP home.

## 4. NativeComponent lifecycle and API

- `render(): View|Element` returns `view('native.x')`. Public properties are state and are exposed to the view; internal state is `native*`-prefixed, so never name a public prop `params`, `layout`, `running`, etc.
- Lifecycle: `mount()` (first push only; any signature, DI and route-bound models allowed), `onResume()` (returning to the screen), `onBackPressed()` (Android back), `unmount()`, `updated{Property}()`. `#[Lazy]` (with `placeholder()`) paints a placeholder while a slow `mount()` runs.
- Attributes (`Native\Mobile\Attributes`): `#[Computed(persist: true)]`, `#[Poll(ms)]` (method or class), `#[Lazy]`, `#[Locked]`, `#[On(EventClass::class | 'string')]`. Do not use `#[OnNative]` (legacy Livewire).
- Blade: `native:poll="1s"` re-renders on a timer; in a child, use it instead of a class-level `#[Poll]`.
- Navigation: `$this->navigate($uri, $data)`, `back()`, `replace($uri, $data)`, `exitToWeb($uri)` (hands back to the WebView, useful while Vue is still the start route), `->transition(Transition::SlideFromBottom)`, `$this->route('name', $params)`, `$this->param('id')`, `$this->data('key', $default)`. No query strings on native routes: pass `$data`. Blade: `@navigate="/path"` (modifiers `.back`, `.replace`, `.fade`, `.slideFromBottom`).
- Async: `$this->async(static fn () => ...)->finished(...)->failed(...)` runs in another interpreter; the closure must be static and cannot capture `$this`.
- Device events: `#[On(PhotoTaken::class)]`; facades under `Native\Mobile\Facades` (`Dialog`, `File`, `Device`, `System`, `Browser`, `Network`, `Share`, ...). Use `Dialog` instead of `alert`/`confirm`.
- Child components: mount with `<native:user-card :user="$u" key="user-{{ $u->id }}" @saved="onSaved" />`. Props flow down and are re-assigned every parent render; a child keeps its own other public state; `$this->emit('saved', ...$args)` bubbles up to `@saved="method"` bindings (bound args first) and string `#[On('saved')]` listeners on any ancestor. Keys must be stable domain ids, never the loop index. No slot content between tags (throws). `navigate()/back()` in a child forward to the screen. Class-level `#[Poll]` on a child does nothing.
- Chrome: author `<native:top-bar title subtitle display-mode="large"><native:top-bar-action id label @tap :ios-icon :android-icon /></native:top-bar>`, `<native:bottom-nav><native:bottom-nav-item id label url :ios-icon :android-icon badge /></native:bottom-nav>`, `<native:fab>`, `<native:bottom-bar>` in the screen Blade; they override the layout's bar for that slot and are reactive. Screens with any chrome must not use `safe-area` classes. Programmatic overrides: `navigationOptions(): ?NavBarOptions`, `tabBarOptions()`, `shouldHideNavBar()`, `$hidesTabBar`, `navTitle()`.

## 5. Routing and layouts

```php
// routes/mobile.php
Route::nativeGroup(MainTabsLayout::class, function () {
    Route::native('/courses', CourseList::class)->name('courses.index');
});
Route::native('/courses/{course}', CourseShow::class)->layout(StackLayout::class);
```

- `Route::native(string $uri, string $componentClass)` registers a normal GET route (so `->name()`, `->where()`, model binding all work) and a `NativeRouter` entry. `->layout(X::class)` overrides the group layout. `Route::nativeGroup(string $layout, Closure)` applies a layout to routes registered inside.
- Order: static segments before `{param}` siblings.
- `NativeRouter::resolve($uri)` returns `['class','layout','params','route']` or null; `NativeRouter::registeredRoutes()` lists everything (use for a route-resolution sweep test). `NativeRouter::isNativeRoute($uri)`.
- `NativeLayout` (all optional): `navBar(NativeComponent $screen): ?NavBar`, `tabBar(...): ?TabBar`, `tabBarAccessory()`, `bottomBar()`, `usesNativeChrome(): bool` (return true for real NavigationStack/TabView), `protected ?string $font`. Builders: `NavBar::make()->title()->subtitle()->back()->backgroundColor()->textColor()->font()->displayMode('large'|'inline')->action(NavAction::make('id')->label()->press('method')->url()->destructive()->items([...]))->searchBar(...)`; `TabBar::make()->add(Tab::link('Courses', '/courses', icon: 'school', ios: Ios::X, android: Android::Y))->activeColor(theme('primary'))->labelVisibility()->highlight($currentUrl)`; `Tab::action()`, `Tab::search()`, `->badge()`. Colors via the global `theme('token')` helper, never hex. Per-screen bar tweaks: `NavBarOptions::make()->title()->hidden()`, `TabBarOptions::make()->hidden()`.

## 6. Theme and fonts

- Tokens live in `config/native-ui.php`: `theme.light`/`theme.dark` (primary, on-primary, secondary, surface, on-surface, background, on-background, surface-variant, on-surface-variant, outline, outline-variant, destructive, on-destructive, success, on-success, accent, on-accent; the set is open-ended, add roles to both blocks) plus `radius-*` and `font-*` sizes. Values accept palette names, hex, `#RRGGBBAA`, `/NN` opacity. Optional pair `input-fill` / `on-input` gives `outlined-text-input` a fill.
- Fonts: files in `resources/fonts/` (`php artisan native:font Inter --weights=400,700`), aliases in `fonts` (`'default'`, `'headline'`, ...). Use `font="headline"`, always with a matching `font-*` weight class; one font file is one weight (avoid `font-bold` on single-weight files).
- Add `$this->app->booted(fn () => \Native\Mobile\UI\Theme::pushToNative());` in `App\Providers\NativeServiceProvider::boot()` (Step 2), otherwise the first push can no-op and fonts fall back to the system font while colors still look right.
- Buttons/inputs/toggles take color from theme variants (`variant="primary|secondary|destructive|success"`); per-instance color overrides are ignored.

## 7. Testing

```php
use Native\Mobile\Testing\Native;

Native::test(CourseList::class, params: [], data: [])->assertSee('...')->tap('Retry')->assertSet('page', 2);
Native::visit('/courses/5')->assertScreen(CourseShow::class);
$bridge = Native::fakeBridge()->respondTo('Network.Status', ['connected' => false]);
```

- Interactions: `tap|press|longPress($refOrLabel)`, `input($target,$text)`, `submit`, `toggle`, `check`, `slide`, `select`, `selectRadio`, `changeTab`, `dismissSheet`, `swipe`, `set($prop,$v)`, `call($method,...$args)`, `firePolls()`/`firePoll($method)`, `emitNative(Event::class, [...])`, `pressBack()`, `search($q)`, `follow()`/`goBack()` for real navigation stacks. Add `ref="..."` on interactive elements for stable targets.
- Assertions: `assertSee|DontSee`, `assertSet|NotSet`, `assertElement($type, fn)`, `assertMissingElement`, `assertNavigatedTo|ReplacedWith|WentBack|ExitedToWeb|NoNavigation`, `assertTransition`, `assertNativeCalled($method, ?fn)`, `assertDispatched`, `assertNavTitle`, `assertHasTabBar|TabBarHidden|NavBarHidden`, `assertHasTab|assertTabActive`, `assertAccessible()`, `assertMatchesSnapshot()`, `tree()`, `get($prop)`, `instance()`, `dumpTree()`, `renderCount`.
- FakeBridge: `respondTo($method, array|string|Closure)`, `withoutCapability(...)`, `assertCalled|NotCalled|CalledTimes|CallOrder|NothingCalled`, `callsTo`, `lastPublish`.
- Wire-format facts: fills live at `style.bg_color` as `#AARRGGBB`; `uppercase` is applied by the renderer (the `text` prop keeps its case); `layout.position` is `[top,right,bottom,left]`, `position_type === 1` means absolute. The harness renders through `createElement`, a different path than the device's streaming collector, so a prop can pass in tests and still be missing on device.
- HTTP feature tests hitting a `Route::native` URI get a 200 stub in tests; use `Native::visit()` for real coverage. Cover happy, failure, offline and 401 paths.

## 8. Gotchas

1. **Route collision with the Vue app.** `routes/mobile.php` is loaded (only on device, under Jump, in `native:*` commands and in tests) inside `Route::middleware('web')` AFTER `routes/web.php`; a later route with the same method and URI replaces an earlier one, and web.php has the SPA catch-all `/{any}` and `/login`. Preserving Vue URIs and route names in `mobile.php` (planned for Step 2) therefore shadows or collides with the SPA routes (`login`, `spa` names) and affects HTTP tests. Decide in Step 2 whether to use a temporary prefix or to keep names distinct until cutover.
2. Empty `<native:column>` paints nothing (background and size discarded); use `<native:rect />` for solid fills or scrims.
3. Absolute children are anchored at their own measured size; `inset-0` does not stretch. Use `absolute top-0 left-0 w-full h-full`. A zero inset means "no anchor": `bottom-0` pins to TOP, `right-0` to LEFT; use `bottom-px`.
4. Aspect ratio goes on the stack, not on a remote image (`aspect-[3/4]` on the stack, image `w-full h-full`).
5. Image `src`: URL, device path, or a path relative to `public/` (`img/logo.png`, no leading slash).
6. `leading-*` only affects multi-line text; iOS cannot tighten below natural line height.
7. Unsupported classes are dropped silently (section 3). Unsized nodes render nothing.
8. Colors work even when the theme push fails; fonts do not (section 6).
9. Slot content between component tags throws; loop index keys break child state; `native:model` is live by default.
10. On-device seeding only via migrations. Never run `native:run` or any build command; the user builds after choosing iOS or Android. Plugins (including mobile-ui, fonts, the Swift/Kotlin sources) compile in at build time.
11. iOS deployment target is already 18.2 (Podfile and pbxproj in `vendor/nativephp/mobile/resources/xcode`), matching mobile-ui's `min_version`.
12. Arch tests: `app/Icons` is excluded from the strict and laravel presets in `tests/Feature/ArchTest.php`; new `App\NativeComponents` and layout classes are not exempt, so keep `declare(strict_types=1);` and follow the strict preset (final classes where the preset requires it).
