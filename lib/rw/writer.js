var fs = require("fs");

module.exports = function(filePath) {
  var error = null,
      callbacks = null,
      descriptor = null,
      bufferLength = 1 << 14, // TODO options
      buffer = new Buffer(bufferLength),
      bufferIndex = 0;

  return function write(data, callback) {

    // If there’s an error, return the error.
    if (error) return void callback(error);

    // If there’s an operation already in-progress, wait for that to finish.
    if (callbacks) return void callbacks.push(callback);

    // If the file hasn’t been opened yet, open it, and then read.
    if (!descriptor) {
      callbacks = [[data, callback]];
      return void fs.open(filePath, "w", 438 /*=0666*/, function(error_, descriptor_) {
        error = error_;
        descriptor = descriptor_;
        var callbacks_ = callbacks;
        callbacks = null;
        callbacks_.forEach(function(args) { write(args[0], args[1]); });
      });
    }

    // If the file is done, flush the buffer and close the file descriptor.
    if (data == null) {
      error = new Error("already closed");
      return void writeAll(descriptor, buffer, 0, bufferIndex, function(error_) {
        if (error_) return void callback(error_);
        fs.close(descriptor, callback);
      });
    }

    // If we can write this to the buffer, do so.
    // Always copy the input data into our private buffer,
    // so that we ignore changes to the input after this function returns.
    var bufferAdded = Math.min(bufferLength - bufferIndex, data.length);
    data.copy(buffer, bufferIndex, 0, bufferAdded);
    bufferIndex += bufferAdded;

    // If the buffer isn’t full, callback immediately.
    if (bufferIndex < bufferLength) return void callback(null);

    // Otherwise, write accumulated bytes to the file.
    callbacks = [[data.slice(bufferAdded), callback]];
    writeAll(descriptor, buffer, 0, bufferIndex, function(error_) {
      error = error_;
      bufferIndex = 0;
      var callbacks_ = callbacks;
      callbacks = null;
      callbacks_.forEach(function(args) { write(args[0], args[1]); });
    });
  };
};

function writeAll(descriptor, buffer, bufferIndex, bufferLength, callback) {
  fs.write(descriptor, buffer, bufferIndex, bufferLength, null, function(error_, bufferLength_) {
    if (error_) return void callback(error_.code === "EPIPE" ? null : error_); // ignore broken pipe, e.g., | head
    if (bufferLength_ < bufferLength) return void writeAll(descriptor, buffer, bufferIndex + bufferLength_, bufferLength - bufferLength_, callback);
    callback(null);
  });
}
