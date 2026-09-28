<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('playback_progress', function (Blueprint $table) {
            $table->foreignId('account_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        $accountCount = DB::table('accounts')->count();
        $accountId = $accountCount === 1 ? DB::table('accounts')->value('id') : null;

        if ($accountId !== null) {
            DB::table('playback_progress')->update(['account_id' => $accountId]);
        }

        Schema::table('playback_progress', function (Blueprint $table) {
            $table->dropIndex(['cid', 'activity_id']);
            $table->index(['account_id', 'cid', 'activity_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('playback_progress', function (Blueprint $table) {
            $table->dropIndex(['account_id', 'cid', 'activity_id']);
            $table->dropConstrainedForeignId('account_id');
            $table->index(['cid', 'activity_id']);
        });
    }
};
