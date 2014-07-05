var fs = require("fs");

module.exports = function(filePath) {
  var error = null,
      eof = false,
      callbacks = null,
      descriptor = null,
      bufferLength = 1 << 14; // TODO options

  return function read(callback) {

    // If there’s an error, return the error.
    if (error) return void callback(error);

    // If we’ve reached the end of the file, return null.
    if (eof) return void callback(null, null);

    // If there’s an operation already in-progress, wait for that to finish.
    if (callbacks) return void callbacks.push(callback);

    // If the file hasn’t been opened yet, open it, and then read.
    if (!descriptor) {
      callbacks = [callback];
      return void fs.open(filePath, "r", 438 /*=0666*/, function(error_, descriptor_) {
        error = error_;
        descriptor = descriptor_;
        var callbacks_ = callbacks;
        callbacks = null;
        callbacks_.forEach(read);
      });
    }

    // Otherwise, read some bytes from the file.
    callbacks = [];
    fs.read(descriptor, new Buffer(bufferLength), 0, bufferLength, null, function(error_, bufferLength_, buffer) {
      error = error_;
      if (bufferLength_) callback(null, bufferLength_ < bufferLength ? buffer.slice(0, bufferLength_) : buffer);
      else eof = true, fs.close(descriptor, callback);
      var callbacks_ = callbacks;
      callbacks = null;
      callbacks_.forEach(read);
    });
  };
};
