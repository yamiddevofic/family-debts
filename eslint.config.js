import tseslint from 'typescript-eslint';
import reglasLocales from './tools/eslint-reglas/index.js';

export default tseslint.config(
  // La fixture de tools/ infringe la regla a propósito; se linta solo desde su prueba.
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts', 'tools/fixtures/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { constitucion: reglasLocales },
    rules: {
      // Artículo III + DT-04.
      'constitucion/sin-dividir-dinero': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // Las pruebas navegan respuestas JSON sin tipar a propósito: tipar cada respuesta de la
    // API en las pruebas las acoplaría a la implementación y taparía justo los cambios de
    // forma que deben detectar.
    files: ['**/test/**/*.ts', '**/test/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
