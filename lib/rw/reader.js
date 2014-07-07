var fs = require("fs");

module.exports = function(filePath) {
  var reader = {
        fill: fill,
        read: read,
        available: 0,
        end: null // TODO allow manual termination
      },
      error = null,
      ended = false,
      fillCallback = null,
      descriptor = null,
      bufferOffset = 0,
      bufferLength = 1 << 14, // TODO options
      buffer = new Buffer(bufferLength);

  fs.open(filePath, "r", 438 /*=0666*/, function(error_, descriptor_) {
    error = error_;
    descriptor = descriptor_;
    if (fillCallback) {
      var fillCallback_ = fillCallback;
      fillCallback = null;
      fill(fillCallback_);
    }
  });

  function fill(callback) {
    if (error) return process.nextTick(callback.bind(reader, error));
    if (fillCallback) throw new Error("cannot fill while a fill is already in progress");
    if (ended) throw new Error("cannot fill after end");
    if (reader.available >= bufferLength) return process.nextTick(callback.bind(reader, null));

    // A fill is now in-progress.
    fillCallback = callback;

    // If the file is not yet open, wait for it.
    if (!descriptor) return;

    // Move any unread bytes to the front of the buffer before filling.
    if (bufferOffset) {
      if (reader.available) buffer.copy(buffer, 0, bufferOffset, bufferOffset + reader.available);
      bufferOffset = 0;
    }

    // Refill the buffer. If no bytes are read, the file has ended.
    fs.read(descriptor, buffer, reader.available, bufferLength - reader.available, null, function(error_, readLength) {
      if (error = error_) return void callback(error);
      if (readLength) reader.available += readLength;
      else ended = true;
      fillCallback = null;
      callback(null);
    });
  }

  // Note: the returned data may not be read after the reader is refilled.
  function read(length) {
    if (error) throw new Error("cannot read after an error occurred");
    if (fillCallback) throw new Error("cannot read while a fill is in progress");
    if (length == null) length = reader.available;
    if (length > reader.available) throw new Error("cannot read that many bytes");
    var bufferOffset0 = bufferOffset;
    reader.available -= length;
    bufferOffset += length;
    return bufferOffset0 || bufferOffset !== bufferLength
        ? buffer.slice(bufferOffset0, bufferOffset)
        : buffer;
  }

  return reader;
};
