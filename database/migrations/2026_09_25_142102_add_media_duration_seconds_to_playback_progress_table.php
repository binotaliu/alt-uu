<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('playback_progress', function (Blueprint $table) {
            $table->float('media_duration_seconds')->nullable()->after('position_seconds');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('playback_progress', function (Blueprint $table) {
            $table->dropColumn('media_duration_seconds');
        });
    }
};
