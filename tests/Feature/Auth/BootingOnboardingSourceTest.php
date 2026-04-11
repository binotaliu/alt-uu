<?php

use Illuminate\Support\Facades\File;

it('renders onboarding flow in booting page with persistence and nou tools toggle', function () {
    $source = File::get(base_path('resources/js/pages/Auth/Booting.vue'));

    expect($source)
        ->toContain('Alt UU 是什麼？')
        ->toContain('保存學習時數')
        ->toContain('NOU 小幫手整合')
        ->toContain('展示圖 Placeholder')
        ->toContain("'/api/preferences/onboarding'")
        ->toContain("'/api/preferences/nou-tools'")
        ->toContain('window.showOnboarding')
        ->toContain('@touchstart.passive="onTouchStart"')
        ->toContain('@touchend.passive="onTouchEnd"');
});
