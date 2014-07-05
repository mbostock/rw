var reader = require("./reader");

module.exports = function(filePath) {
  var read = reader(filePath), // TODO options
      callbacks,
      buffer = new Buffer(0),
      bufferIndex = 0,
      bufferLength = 0,
      fragments = null;

  return function readFixed(length, callback) {
    if (!((length = +length) >= 0)) return void callback(new Error("invalid length"));

    // If we’ve reached the end of the file, return null.
    if (!buffer) {

      // Combine this with previously-read fragments, if any.
      if (fragments) {
        fragment = Buffer.concat(fragments);
        fragments = null;
        return void callback(null, fragment);
      }

      return void callback(null, null);
    }

    // If we’re at the end of our buffer, read some bytes, then try again.
    if (bufferIndex >= bufferLength) {
      var args = [length, callback];
      if (callbacks) return void callbacks.push(args);
      callbacks = [args];
      return void read(function(error_, buffer_) {
        error = error_;
        buffer = buffer_;
        bufferIndex = 0;
        bufferLength = buffer && buffer.length;
        var callbacks_ = callbacks;
        callbacks = null;
        callbacks_.forEach(function(args) { readFixed(args[0], args[1]); });
      });
    }

    // Slice the buffer up to the line terminator.
    var bufferAvailable = bufferLength - bufferIndex,
        fragment = buffer.slice(bufferIndex, bufferIndex += length);

    // If we have enough to read the requested bytes, return it.
    if (bufferIndex <= bufferLength) {

      // Combine this with previously-read fragments, if any.
      if (fragments) {
        fragments.push(fragment);
        fragment = Buffer.concat(fragments);
        fragments = null;
      }

      return void callback(null, fragment);
    }

    // Otherwise, combine this fragment with data from the next chunk.
    if (fragments) fragments.push(fragment);
    else fragments = [fragment];
    readFixed(length - bufferAvailable, callback);
  };
};
