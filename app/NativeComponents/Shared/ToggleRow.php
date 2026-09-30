<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Settings row: label, optional description and a switch.
 *
 * Tag: `<native:toggle-row key="pref-x" label="..." description="..." :value="$prefs->x" :saving="$saving === 'x'" @toggled="save('x')" />`
 *
 * Props: `label`, `description`, `value` (bool, the persisted state; the host
 * owns it), `saving` (bool, dims the row and blocks input while persisting),
 * `disabled` (bool).
 * Events: `toggled` with the requested new value as the LAST argument
 * (`@toggled="save('x')"` calls `save('x', true)`). The host persists it and
 * updates `value`; on failure it just leaves `value` unchanged and the switch
 * snaps back on the next render.
 */
final class ToggleRow extends NativeComponent
{
    public string $label = '';

    public string $description = '';

    public bool $value = false;

    public bool $saving = false;

    public bool $disabled = false;

    public function toggle(bool $checked): void
    {
        if ($this->disabled || $this->saving) {
            return;
        }

        $this->emit('toggled', $checked);
    }

    public function render(): View
    {
        return view('native.shared.toggle-row');
    }
}
