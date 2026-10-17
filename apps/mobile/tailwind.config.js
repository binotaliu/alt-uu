/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{ts,tsx}', '../../packages/*/src/**/*.{ts,tsx}'],
    presets: [
        require('nativewind/preset'),
        require('@altuu/ui/tailwind-preset'),
    ],
};
