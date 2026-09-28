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
            $table->dropIndex(['account_id', 'cid', 'activity_id']);
            $table->unique(['account_id', 'cid', 'activity_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('playback_progress', function (Blueprint $table) {
            $table->dropUnique(['account_id', 'cid', 'activity_id']);
            $table->index(['account_id', 'cid', 'activity_id']);
        });
    }
};
