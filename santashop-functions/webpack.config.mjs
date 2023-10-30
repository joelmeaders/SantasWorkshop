import path from "path";
import { fileURLToPath } from "url";
import linkerPlugin from "@angular/compiler-cli/linker/babel";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

// The cost of being fancy I suppose
// https://github.com/firebase/firebase-tools/issues/653

export default {
	target: "node",
	mode: "production",
	entry: "./src/index.ts",
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: "babel-loader",
				exclude: /node_modules/,
				options: {
					plugins: [
						linkerPlugin,
						["@babel/plugin-proposal-decorators", { legacy: true }],
					],
					compact: false,
					cacheDirectory: true,
					presets: [
						[
							"@babel/preset-env",
							{ useBuiltIns: "entry", corejs: "3.25" },
						],
						["@babel/preset-typescript", { allowNamespaces: true }],
					],
				},
			},
		],
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js", ".json", ".mjs"],
	},
	output: {
		filename: "index.js",
		path: path.resolve(__dirname, "dist"),
		libraryTarget: "commonjs",
	},
	externals: {
		"firebase-admin": "firebase-admin",
		"firebase-functions": "firebase-functions",
	},
};
