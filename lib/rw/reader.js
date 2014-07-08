module.exports = function(open, read, close) {
  var reader = {
        bufferLength: reader_bufferLength,
        fill: reader_fill,
        read: reader_read,
        ended: false,
        end: null // TODO allow manual termination
      },
      error = null,
      fillCallback = null,
      channel = null,
      bufferOffset = 0,
      bufferLength = 1 << 16,
      bufferAvailable = 0,
      buffer = new Buffer(bufferLength);

  open(function(error_, channel_) {
    error = error_;
    channel = channel_;
    if (fillCallback) {
      var fillCallback_ = fillCallback;
      fillCallback = null;
      reader_fill(fillCallback_);
    }
  });

  function reader_bufferLength(bufferLength_) {
    if (arguments.length) {
      if (bufferAvailable) throw new Error("cannot change buffer length while the buffer is not empty");
      if (fillCallback) throw new Error("cannot change buffer length while the buffer is filling");
      if ((bufferLength_ |= 0) <= 0) throw new Error("invalid length: " + bufferLength_);
      buffer = new Buffer(bufferLength = bufferLength_);
      return reader;
    }
    return bufferLength;
  }

  function reader_fill(callback) {
    if (error) return process.nextTick(callback.bind(reader, error));
    if (fillCallback) throw new Error("cannot fill while a fill is already in progress");
    if (reader.ended) throw new Error("cannot fill after end");
    if (bufferAvailable >= bufferLength) return process.nextTick(callback.bind(reader, null));

    // A fill is now in-progress.
    fillCallback = callback;

    // If the channel is not yet open, wait for it.
    if (!channel) return;

    // Move any unread bytes to the front of the buffer before filling.
    if (bufferOffset) {
      if (bufferAvailable) buffer.copy(buffer, 0, bufferOffset, bufferOffset + bufferAvailable);
      bufferOffset = 0;
    }

    // Fill the buffer. If no bytes are read, the channel has ended.
    read(channel, buffer, bufferAvailable, bufferLength - bufferAvailable, function(error_, readLength) {
      if (error = error_) return void callback(error);
      if (readLength) bufferAvailable += readLength;
      else reader.ended = true, close(channel, function(ignore) {});
      fillCallback = null;
      callback(null);
    });
  }

  // Note: the returned data may not be read after the reader starts filling.
  function reader_read(length) {
    if (error) throw new Error("cannot read after an error occurred");
    if (fillCallback) throw new Error("cannot read while a fill is in progress");
    if (length == null) length = bufferAvailable;
    else if ((length |= 0) <= 0) throw new Error("invalid length: " + length);
    if (!bufferAvailable || length > bufferAvailable) return null;
    var bufferOffset0 = bufferOffset;
    bufferAvailable -= length;
    bufferOffset += length;
    return bufferOffset0 || bufferOffset !== bufferLength
        ? buffer.slice(bufferOffset0, bufferOffset)
        : buffer;
  }

  return reader;
};
