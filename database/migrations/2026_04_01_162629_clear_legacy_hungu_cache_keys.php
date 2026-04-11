<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $cacheTable = (string) config('cache.stores.database.table', 'cache');

        if (! Schema::hasTable($cacheTable)) {
            return;
        }

        DB::table($cacheTable)
            ->where('key', 'hungu.courses')
            ->orWhere('key', 'alt-uu:courses:list')
            ->orWhere('key', 'hungu.course_path_info.ids')
            ->orWhere('key', 'like', 'hungu.course_path_info.%')
            ->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration removes stale cache rows only.
    }
};
