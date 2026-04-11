<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('playback_progress', function (Blueprint $table) {
            $table->id();
            $table->string('cid', 64);
            $table->string('activity_id', 191);
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->float('position_seconds')->default(0);
            $table->boolean('hungu_upload_success')->nullable();
            $table->timestamps();

            $table->index(['cid', 'activity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('playback_progress');
    }
};
