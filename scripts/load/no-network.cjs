// Preload for local validation only. It blocks outbound sockets before application imports.
const net = require('node:net');
const { syncBuiltinESMExports } = require('node:module');
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
	const first = args[0];
	const options = Array.isArray(first) ? first[0] : first;
	const host = typeof options === 'object' ? options.host : args[1];
	const pipe =
		typeof options === 'object'
			? options.path
			: typeof options === 'string' && !/^\d+$/.test(options)
				? options
				: undefined;
	if (!pipe && host && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
		throw new Error(
			'Offline validation blocked an external network connection.',
		);
	}
	return originalConnect.apply(this, args);
};
syncBuiltinESMExports();
