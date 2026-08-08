import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export const baseConfig = [
  { ignores: [".next/**", ".turbo/**", "dist/**", "generated/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier
];
