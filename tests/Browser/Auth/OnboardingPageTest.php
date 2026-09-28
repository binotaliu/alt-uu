<?php

use App\Models\KeyValueStore;

it('shows the first onboarding slide', function () {
    visit('/onboarding')
        ->assertSee('歡迎使用 Alt UU')
        ->assertSee('這是什麼 App？')
        ->assertSee('1 / 3');
});

it('advances through the slides and finishes onboarding', function () {
    visit('/onboarding')
        ->assertSee('1 / 3')
        ->click('繼續')
        ->assertSee('保存學習時數')
        ->assertSee('2 / 3')
        ->click('繼續')
        ->assertSee('NOU 小幫手整合')
        ->assertSee('3 / 3')
        ->click('開始使用')
        ->assertPathIs('/login');
});

it('persists the onboarding-completed preference after finishing', function () {
    visit('/onboarding')
        ->assertSee('1 / 3')
        ->click('繼續')
        ->click('繼續')
        ->click('開始使用')
        ->assertPathIs('/login');

    $record = KeyValueStore::query()->where('key', 'preference:onboarding-completed')->first();

    expect($record)->not->toBeNull();
    expect(json_decode($record->value, true, 512, JSON_THROW_ON_ERROR))->toBe(['completed' => true]);
});

it('goes back to the previous slide', function () {
    visit('/onboarding')
        ->assertSee('1 / 3')
        ->click('繼續')
        ->assertSee('2 / 3')
        ->click('上一頁')
        ->assertSee('1 / 3')
        ->assertSee('這是什麼 App？');
});
