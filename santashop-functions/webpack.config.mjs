import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

// The cost of being fancy I suppose
// https://github.com/firebase/firebase-tools/issues/653

export default {
	target: 'node',
	mode: 'production',
	entry: './src/index.ts',
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: 'babel-loader',
				exclude: /node_modules/,
				options: {
					plugins: [
						[
							'@babel/plugin-proposal-decorators',
							{ version: 'legacy' },
						],
					],
					compact: false,
					cacheDirectory: true,
					presets: [
						['@babel/preset-env'],
						['@babel/preset-typescript', { allowNamespaces: true }],
					],
				},
			},
		],
	},
	resolve: {
		alias: {
			'@santashop/models': path.resolve(
				__dirname,
				'../santashop-models/src/index.ts',
			),
		},
		extensions: ['.tsx', '.ts', '.js', '.json', '.mjs'],
	},
	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, 'dist'),
		libraryTarget: 'commonjs2',
	},
	externals: {
		'firebase-admin': 'firebase-admin',
		'firebase-functions': 'firebase-functions',
	},
	plugins: [
		new webpack.DefinePlugin({
			'process.env.NODE_ENV': JSON.stringify('production'),
		}),
	],
};
