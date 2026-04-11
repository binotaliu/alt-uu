<?php

use App\Providers\AppServiceProvider;
use App\Providers\EventServiceProvider;
use App\Providers\NativeServiceProvider;
use App\Providers\TypeScriptTransformerServiceProvider;
use Spatie\LaravelTypeScriptTransformer\TypeScriptTransformerApplicationServiceProvider;

return [
    AppServiceProvider::class,
    EventServiceProvider::class,
    NativeServiceProvider::class,
    ...(
        class_exists(TypeScriptTransformerApplicationServiceProvider::class)
            ? [TypeScriptTransformerServiceProvider::class]
            : []
    ),
];
