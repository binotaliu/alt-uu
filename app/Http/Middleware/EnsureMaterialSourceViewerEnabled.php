<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureMaterialSourceViewerEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('app.material_source_viewer_enabled'), 404);

        return $next($request);
    }
}
