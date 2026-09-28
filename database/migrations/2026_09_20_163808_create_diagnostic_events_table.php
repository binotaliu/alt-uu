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
        Schema::create('diagnostic_events', function (Blueprint $table) {
            $table->id();
            // Millisecond precision: ordering is the whole point when
            // diagnosing races between concurrent requests.
            $table->timestamp('occurred_at', 3);
            $table->string('type');
            $table->string('level')->default('info');
            $table->string('source')->default('server');
            $table->string('op')->nullable();
            $table->string('request_id')->nullable();
            $table->text('summary');
            $table->unsignedSmallInteger('status')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->json('context')->nullable();

            $table->index('occurred_at');
            $table->index('request_id');
            $table->index(['level', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('diagnostic_events');
    }
};
