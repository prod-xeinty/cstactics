// Линтер: ловим ошибки, а не стиль. Форматирование — не его задача.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".next/",
      ".wrangler/",
      "migrations/meta/",
      "worker-configuration.d.ts",
      "next-env.d.ts",
      "design/",
      "probe/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.{js,mjs}", "*.config.{js,mjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Неиспользуемое с подчёркиванием — намеренно (например, деструктуризация, чтобы выкинуть поле).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Безопасность: никаких eval и строк-функций.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      // Пользовательский текст (тактики, ники) никогда не выводим как HTML — только через JSX.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Не выводим HTML строкой: пользовательский текст только через JSX (AGENTS.md, раздел 11, п. 6).",
        },
      ],
    },
  },
);
