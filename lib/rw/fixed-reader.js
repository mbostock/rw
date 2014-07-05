var reader = require("./reader");

module.exports = function(filePath) {
  var read = reader(filePath), // TODO options
      defers,
      buffer = new Buffer(0),
      bufferIndex = 0,
      bufferLength = 0,
      fragments = null;

  return function readFixed(length, callback) {
    if (!((length = +length) >= 0)) throw new Error("invalid length");
    if (!callback) throw new Error("callback is required");

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
      var defer = [length, callback];
      if (defers) return void defers.push(defer);
      defers = [defer];
      return void read(function(error_, buffer_) {
        error = error_;
        buffer = buffer_;
        bufferIndex = 0;
        bufferLength = buffer && buffer.length;
        var defers_ = defers;
        defers = null;
        defers_.forEach(function(defer) { readFixed(defer[0], defer[1]); });
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
