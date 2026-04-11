<?php

use App\Models\KeyValueStore;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    KeyValueStore::query()
        ->where('key', 'preference:onboarding-completed')
        ->delete();
});

it('stores onboarding completion preference', function () {
    getJson('/api/preferences/onboarding')
        ->assertOk()
        ->assertExactJson(['completed' => false]);

    postJson('/api/preferences/onboarding', ['completed' => true])
        ->assertCreated()
        ->assertExactJson(['completed' => true]);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:onboarding-completed',
        'value' => json_encode(['completed' => true]),
    ]);

    getJson('/api/preferences/onboarding')
        ->assertOk()
        ->assertExactJson(['completed' => true]);
});
