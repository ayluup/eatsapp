// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions corre en Deno, no en la app
    ignores: ['dist/*', 'supabase/functions/*'],
  },
]);
