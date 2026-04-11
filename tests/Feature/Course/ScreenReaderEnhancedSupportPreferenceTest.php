<?php

use App\Models\KeyValueStore;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    KeyValueStore::query()
        ->where('key', 'preference:screen-reader-enhanced-support')
        ->delete();
});

it('stores screen reader enhanced support preference', function () {
    getJson('/api/preferences/screen-reader-enhanced-support')
        ->assertOk()
        ->assertExactJson(['enabled' => false]);

    postJson('/api/preferences/screen-reader-enhanced-support', ['enabled' => true])
        ->assertCreated()
        ->assertExactJson(['enabled' => true]);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:screen-reader-enhanced-support',
        'value' => json_encode(['enabled' => true]),
    ]);

    getJson('/api/preferences/screen-reader-enhanced-support')
        ->assertOk()
        ->assertExactJson(['enabled' => true]);
});

it('returns screen reader preference in app config', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:screen-reader-enhanced-support'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    getJson('/api/config')
        ->assertOk()
        ->assertJsonPath('screenReaderEnhancedSupportEnabled', true);
});
