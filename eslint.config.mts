import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// moment is a devDependency used only for typings/testing; Obsidian provides the
		// real moment module at runtime, so it is never bundled and is safe to keep.
		files: ['package.json'],
		rules: {
			'depend/ban-dependencies': [
				'error',
				{
					presets: ['native', 'microutilities', 'preferred'],
					allowed: ['moment'],
				},
			],
		},
	},
	{
		// Test files mock the "obsidian" module (not available outside the Obsidian
		// runtime), which necessarily involves loosely-typed/"any" stand-ins for the
		// real Obsidian classes. Relax the type-safety rules here rather than in
		// production source.
		files: ['**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"coverage",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
