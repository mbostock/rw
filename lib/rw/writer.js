module.exports = function(open, write, close) {
  var writer = {
        flush: writer_flush,
        write: writer_write,
        available: Infinity,
        ended: false,
        end: end
      },
      error = null,
      flushCallback = null,
      channel = null,
      bufferOffset = 0,
      bufferLength = 1 << 14, // TODO options
      buffer;

  open(function(error_, channel_) {
    error = error_;
    channel = channel_;
    if (flushCallback) {
      var flushCallback_ = flushCallback;
      flushCallback = null;
      writer_flush(flushCallback);
    }
  });

  function writer_flush(callback) {
    if (error) return process.nextTick(callback.bind(writer, error));
    if (flushCallback) throw new Error("cannot flush while a flush is already in progress");
    if (writer.ended) throw new Error("cannot flush after end");
    if (bufferOffset <= 0) return process.nextTick(callback.bind(writer, null));

    // A flush is now in-progress.
    flushCallback = callback;

    // If the channel is not yet open, wait for it.
    if (!channel) return;

    // Flush the buffer.
    write(channel, buffer, 0, bufferOffset, function(error_) {
      if (error = error_) return void callback(error);
      writer.available = Infinity;
      bufferOffset = 0;
      buffer = null;
      flushCallback = null;
      callback(null);
    });
  }

  // Note: the passed data must not be modified before the writer is flushed.
  function writer_write(data) {
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
    writer_flush(function(error) {
      if (error) return void callback(error);
      writer.ended = true;

      // Close the channel channel.
      var channel_ = channel;
      channel = null;
      close(channel_, callback);
    });
  }

  return writer;
};
