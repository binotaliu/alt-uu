<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Deletes duplicate (account_id, cid, activity_id) rows, keeping the most-recently
     * updated one, so the following migration can safely add a unique constraint. Uses
     * raw queries (not the Eloquent model) to avoid cast/event side effects during a
     * bulk cleanup.
     */
    public function up(): void
    {
        $duplicateGroups = DB::table('playback_progress')
            ->select('account_id', 'cid', 'activity_id')
            ->whereNotNull('account_id')
            ->groupBy('account_id', 'cid', 'activity_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicateGroups as $group) {
            $rows = DB::table('playback_progress')
                ->where('account_id', $group->account_id)
                ->where('cid', $group->cid)
                ->where('activity_id', $group->activity_id)
                ->orderByDesc('updated_at')
                ->orderByDesc('id')
                ->get(['id']);

            $idsToDelete = $rows->slice(1)->pluck('id');

            DB::table('playback_progress')->whereIn('id', $idsToDelete)->delete();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Deleted duplicate rows cannot be restored; this migration is intentionally
        // irreversible.
    }
};
