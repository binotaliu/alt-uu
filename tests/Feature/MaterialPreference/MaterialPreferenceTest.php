<?php

use App\Models\KeyValueStore;
use App\Services\UUSessionStore;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    KeyValueStore::query()
        ->where('key', 'preference:material-html-scale')
        ->delete();
});

function seedHunguSession(string $username = 's1234567'): void
{
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-example',
        'session_idx' => 'idx-example',
        'cookies' => [],
        'profile' => [
            'display_name' => '測試學生',
            'username' => $username,
            'picture' => 'https://uu.nou.edu.tw/avatar.png',
            'realname' => '測試學生',
        ],
    ]);
}

it('returns the default scale when no preference is saved', function () {
    seedHunguSession();

    $response = getJson('/api/preferences/material-font-scale');

    $response->assertOk();
    $response->assertExactJson(['scale' => 1]);
});

it('persists the font scale preference globally', function () {
    seedHunguSession();

    $response = postJson('/api/preferences/material-font-scale', ['scale' => 1.35]);

    $response->assertCreated();
    $response->assertExactJson(['scale' => 1.35]);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:material-html-scale',
        'value' => json_encode(['scale' => 1.35]),
    ]);

    getJson('/api/preferences/material-font-scale')
        ->assertExactJson(['scale' => 1.35]);
});
