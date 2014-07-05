var fs = require("fs");

module.exports = function(filePath) {
  var error = null,
      eof = false,
      defers = [],
      descriptor = null,
      bufferLength = 1 << 14; // TODO options

  function read(callback) {
    if (!callback) throw new Error("callback is required");

    // If there’s an error, return the error.
    if (error) return void callback(error);

    // If we’ve reached the end of the file, return null.
    if (eof) return void callback(null, null);

    // If there’s an operation already in-progress, wait for that to finish.
    if (defers) return void defers.push(callback);

    // Otherwise, read some bytes from the file.
    defers = [];
    fs.read(descriptor, new Buffer(bufferLength), 0, bufferLength, null, function(error_, bufferLength_, buffer) {
      error = error_;
      if (bufferLength_) callback(null, bufferLength_ < bufferLength ? buffer.slice(0, bufferLength_) : buffer);
      else eof = true, fs.close(descriptor, callback);
      var defers_ = defers;
      defers = null;
      defers_.forEach(read);
    });
  }

  // Open the file for reading.
  fs.open(filePath, "r", 438 /*=0666*/, function(error_, descriptor_) {
    error = error_;
    descriptor = descriptor_;
    var defers_ = defers;
    defers = null;
    defers_.forEach(read);
  });

  return read;
};
