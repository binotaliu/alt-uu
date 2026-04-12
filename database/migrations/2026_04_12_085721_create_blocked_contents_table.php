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
        Schema::create('blocked_contents', function (Blueprint $table) {
            $table->id();
            $table->string('board_hash', 64);
            $table->string('node_hash', 64);
            $table->string('reason', 1);
            $table->timestamp('blocked_at');
            $table->timestamps();

            $table->unique(['board_hash', 'node_hash']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('blocked_contents');
    }
};
