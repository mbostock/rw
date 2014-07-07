var fs = require("fs");

module.exports = function(filePath) {
  var writer = {
        flush: flush,
        write: write,
        available: Infinity,
        ended: false,
        end: end
      },
      error = null,
      flushCallback = null,
      descriptor = null,
      bufferOffset = 0,
      bufferLength = 1 << 14, // TODO options
      buffer;

  fs.open(filePath, "w", 438 /*=0666*/, function(error_, descriptor_) {
    error = error_;
    descriptor = descriptor_;
    if (flushCallback) {
      var flushCallback_ = flushCallback;
      flushCallback = null;
      flush(flushCallback);
    }
  });

  function flush(callback) {
    if (error) return process.nextTick(callback.bind(writer, error));
    if (flushCallback) throw new Error("cannot flush while a flush is already in progress");
    if (writer.ended) throw new Error("cannot flush after end");
    if (bufferOffset <= 0) return process.nextTick(callback.bind(writer, null));

    // A flush is now in-progress.
    flushCallback = callback;

    // If the file is not yet open, wait for it.
    if (!descriptor) return;

    // Flush the buffer. This may require multiple writes.
    writeAll(descriptor, buffer, 0, bufferOffset, function(error_) {
      // if (error_ && error_.code === "EPIPE") error_ = null; // TODO ignore broken pipe and ignore subsequent writes
      if (error = error_) return void callback(error);
      writer.available = Infinity;
      bufferOffset = 0;
      buffer = null;
      flushCallback = null;
      callback(null);
    });
  }

  // Note: the passed data must not be modified before the writer is flushed.
  function write(data) {
    if (error) throw new Error("cannot write after an error occurred");
    if (flushCallback) throw new Error("cannot write while a flush is in progress");
    if (data.length > writer.available) throw new Error("cannot write that many bytes");

    // If we already have a buffer, then copy the new data into the buffer.
    if (buffer) {

      // If we don’t own the buffer (because we previously avoided a copy),
      // then copy the buffer first before copying the new data into it.
      if (bufferOffset === buffer.length) {
        var buffer_ = buffer;
        buffer = new Buffer(bufferLength);
        buffer_.copy(buffer);
      }

      data.copy(buffer, bufferOffset);
      bufferOffset += data.length;
      writer.available = bufferLength - bufferOffset;
    }

    // Otherwise, the new data becomes the buffer.
    // This avoids a copy in the case that the data is large
    // and only one chunk of data is written per flush.
    else {
      buffer = data;
      bufferOffset = data.length;
      writer.available = Math.max(0, bufferLength - bufferOffset);
    }
  }

  function end(callback) {
    if (error) throw new Error("cannot end after an error occurred");
    if (writer.ended) throw new Error("cannot end after already ended");

    // Flush any buffered bytes.
    flush(function close(error) {
      if (error) return void callback(error);
      writer.ended = true;

      // Close the file descriptor.
      fs.close(descriptor, callback);
    });
  }

  return writer;
};

function writeAll(descriptor, buffer, bufferOffset, bufferLength, callback) {
  fs.write(descriptor, buffer, bufferOffset, bufferLength, null, function(error, writeLength) {
    if (error) return void callback(error);
    if (writeLength < bufferLength) return void writeAll(descriptor, buffer, bufferOffset + writeLength, bufferLength - writeLength, callback);
    callback(null);
  });
}
