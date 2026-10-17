import js from '@eslint/js';
import expoFlat from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactNativeImports = [
    'react',
    'react-dom',
    'react-native',
    'react-native/*',
    'react-native-*',
    '@react-native/*',
    '@react-native-*',
    'expo',
    'expo-*',
    'expo/*',
    'nativewind',
    '@altuu/ui',
    '@altuu/features',
];

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.expo/**',
            '**/coverage/**',
            'apps/mobile/ios/**',
            'apps/mobile/android/**',
            'modules/*/ios/**',
            'modules/*/android/**',
            'tools/legacy-fixtures-gen/**',
            'modules/*/build/**',
            'packages/core/test/fixtures/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: { globals: { ...globals.node } },
    },
    {
        files: ['**/*.{js,cjs}'],
        languageOptions: { sourceType: 'commonjs' },
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        files: ['packages/{ui,features}/**/*.{ts,tsx}'],
        ...react.configs.flat.recommended,
        settings: { react: { version: 'detect' } },
    },
    {
        files: ['packages/{ui,features}/**/*.{ts,tsx}'],
        ...react.configs.flat['jsx-runtime'],
    },
    {
        files: ['packages/{ui,features}/**/*.{ts,tsx}'],
        ...reactHooks.configs.flat.recommended,
    },
    {
        files: ['packages/{ui,features}/**/*.{ts,tsx}'],
        languageOptions: { globals: { ...globals.jest } },
        rules: { 'react/prop-types': 'off' },
    },
    ...expoFlat.map((config) => ({
        ...config,
        files: ['apps/mobile/**/*.{js,jsx,ts,tsx}'],
    })),
    {
        files: ['**/*.{js,cjs}'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        files: ['packages/core/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: reactNativeImports,
                            message:
                                '@altuu/core must stay platform-agnostic: no React / React Native / Expo imports. Inject platform services via src/platform instead.',
                        },
                    ],
                },
            ],
        },
    },
    prettier,
);
