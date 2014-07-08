module.exports = function(open, write, close) {
  var writer = {
        encoding: writer_encoding,
        bufferLength: writer_bufferLength,
        flush: writer_flush,
        write: writer_write,
        ended: false,
        end: end
      },
      error = null,
      flushCallback = null,
      channel = null,
      encoding = null,
      bufferOffset = 0,
      bufferLength = 1 << 14,
      bufferAvailable = Infinity,
      buffer;

  open(function(error_, channel_) {
    error = error_;
    channel = channel_;
    if (flushCallback) {
      var flushCallback_ = flushCallback;
      flushCallback = null;
      writer_flush(flushCallback_);
    }
  });

  function writer_encoding(encoding_) {
    if (arguments.length) {
      if (encoding_ == null) encoding_ = null;
      else if (!Buffer.isEncoding(encoding_ = encoding_ + "")) throw new Error("unknown encoding: " + encoding_);
      encoding = encoding_;
      return writer;
    }
    return encoding;
  }

  function writer_bufferLength(bufferLength_) {
    if (arguments.length) {
      if (bufferOffset) throw new Error("cannot change buffer length while the buffer is not empty");
      if (!((bufferLength_ = +bufferLength_) > 0)) throw new Error("invalid length: " + bufferLength_);
      bufferLength = bufferLength_;
      return writer;
    }
    return bufferLength;
  }

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
      bufferAvailable = Infinity;
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
    if (encoding != null) data = new Buffer(data + "", encoding);
    if (data.length > bufferAvailable) return null;

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
      bufferAvailable = bufferLength - bufferOffset;
    }

    // Otherwise, the new data becomes the buffer.
    // This avoids a copy in the case that the data is large
    // and only one chunk of data is written per flush.
    else {
      buffer = data;
      bufferOffset = data.length;
      bufferAvailable = Math.max(0, bufferLength - bufferOffset);
    }

    return data;
  }

  function end(callback) {
    if (error) throw new Error("cannot end after an error occurred");
    if (writer.ended) throw new Error("cannot end after already ended");

    // Flush any buffered bytes.
    writer_flush(function(error) {
      if (error) return void callback(error);
      writer.ended = true;

      // Close the channel.
      var channel_ = channel;
      channel = null;
      close(channel_, callback);
    });
  }

  return writer;
};
