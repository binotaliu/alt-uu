<?php

use App\Models\KeyValueStore;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    KeyValueStore::query()
        ->where('key', 'preference:live-sessions-timezone')
        ->delete();
});

it('stores live sessions timezone preference', function () {
    getJson('/api/preferences/live-sessions-timezone')
        ->assertOk()
        ->assertExactJson(['timezone' => 'taiwan']);

    postJson('/api/preferences/live-sessions-timezone', ['timezone' => 'local'])
        ->assertCreated()
        ->assertExactJson(['timezone' => 'local']);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:live-sessions-timezone',
        'value' => json_encode(['timezone' => 'local']),
    ]);

    getJson('/api/preferences/live-sessions-timezone')
        ->assertOk()
        ->assertExactJson(['timezone' => 'local']);
});

it('rejects invalid live sessions timezone preference', function () {
    postJson('/api/preferences/live-sessions-timezone', ['timezone' => 'utc'])
        ->assertUnprocessable();
});
