module.exports = function(open, write, close) {
  var writer = {
        encoding: writer_encoding,
        bufferLength: writer_bufferLength,
        drain: writer_drain,
        write: writer_write,
        ended: false,
        end: end
      },
      error = null,
      drainCallback = null,
      channel = null,
      encoding = "utf8",
      bufferUsed = 0,
      bufferLength = 1 << 14,
      buffers = [];

  open(function(error_, channel_) {
    error = error_;
    channel = channel_;
    if (drainCallback) {
      var drainCallback_ = drainCallback;
      drainCallback = null;
      writer_drain(drainCallback_);
    }
  });

  function writer_encoding(encoding_) {
    if (arguments.length) {
      if (!Buffer.isEncoding(encoding_ = encoding_ + "")) throw new Error("unknown encoding: " + encoding_);
      encoding = encoding_;
      return writer;
    }
    return encoding;
  }

  function writer_bufferLength(bufferLength_) {
    if (arguments.length) {
      if (bufferUsed) throw new Error("cannot change buffer length while the buffer is not empty");
      if ((bufferLength_ |= 0) <= 0) throw new Error("invalid length: " + bufferLength_);
      bufferLength = bufferLength_;
      return writer;
    }
    return bufferLength;
  }

  function writer_drain(callback) {
    if (error) return process.nextTick(callback.bind(writer, error));
    if (drainCallback) throw new Error("cannot drain while a drain is already in progress");
    if (writer.ended) throw new Error("cannot drain after end");
    if (!buffers.length) return process.nextTick(callback.bind(writer, null));

    // A drain is now in-progress.
    drainCallback = callback;

    // If the channel is not yet open, wait for it.
    if (!channel) return;

    // Write each buffer, in their original order.
    buffers.reverse();
    (function writeNext(error_) {
      if (error = error_) return drainCallback = null, void callback(error);
      var buffer = buffers.pop();
      if (!buffer) return drainCallback = null, bufferUsed = 0, void callback(null);
      write(channel, buffer, 0, buffer.length, writeNext);
    })(null);
  }

  // Note: the passed data must not be modified before the writer is done draining.
  function writer_write(data) {
    if (error) throw new Error("cannot write after an error occurred");
    if (drainCallback) throw new Error("cannot write while a drain is already in progress");
    if (!(data instanceof Buffer)) data = new Buffer(data + "", encoding);
    buffers.push(data);
    bufferUsed += data.length;
    return bufferUsed < bufferLength;
  }

  function end(callback) {
    if (error) throw new Error("cannot end after an error occurred");
    if (writer.ended) throw new Error("cannot end after already ended");

    // drain any buffered bytes.
    writer_drain(function(error) {
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
