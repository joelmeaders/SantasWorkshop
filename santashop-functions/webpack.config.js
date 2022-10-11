const path = require("path");
const linkerPlugin = require("@angular/compiler-cli/linker/babel");

// The cost of being fancy I suppose
// https://github.com/firebase/firebase-tools/issues/653

module.exports = {
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
							{ useBuiltIns: "usage", corejs: 3 },
						],
						["@babel/preset-typescript", { allowNamespaces: true }],
					],
				},
			},
		],
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js", ".json"],
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
