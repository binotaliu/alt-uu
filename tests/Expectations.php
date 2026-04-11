<?php

use Pest\Arch\Contracts\ArchExpectation;
use Pest\Arch\Expectations\Targeted;
use Pest\Arch\Objects\ObjectDescription;
use Pest\Arch\Support\FileLineFinder;
use Pest\Support\Reflection;

expect()->extend('toHaveOnlyCamelCasePublicProperties', function (): ArchExpectation {
    return Targeted::make(
        $this,
        fn (ObjectDescription $object): bool => isset($object->reflectionClass) === false
            || array_filter(
                Reflection::getPropertiesFromReflectionClass($object->reflectionClass),
                fn (ReflectionProperty $property): bool => $property->isPublic()
                    && preg_match('/^[a-z]+([A-Z][a-z0-9]+)*$/', $property->name) !== 1,
            ) === [],
        'to have only camelCase public properties',
        FileLineFinder::where(fn (string $line): bool => str_contains($line, 'class'))
    );
});
