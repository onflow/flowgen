// wasm-to-uint8array-loader.js
module.exports = function (source) {
	// 'source' will be the raw buffer from raw-loader
	const wasmBinary = Buffer.isBuffer(source) ? source : Buffer.from(source);
	// Export it as a JavaScript module that defaults to a Uint8Array
	return `export default new Uint8Array([${wasmBinary.join(",")}]);`;
};
