module.exports = function(open, read, close) {
  var reader = {
        bufferLength: reader_bufferLength,
        fill: reader_fill,
        read: reader_read,
        end: reader_end,
        ended: false
      },
      error = null,
      fillCallback = null,
      channel = null,
      bufferOffset = 0,
      bufferLength = 1 << 16,
      bufferAvailable = 0,
      buffer = new Buffer(bufferLength);

  process.nextTick(open.bind(null, function(newError, newChannel) {
    error = newError;
    channel = newChannel;
    if (fillCallback) {
      var oldFillCallback = fillCallback;
      fillCallback = null;
      reader_fill(oldFillCallback);
    }
  }));

  function reader_bufferLength(newBufferLength) {
    if (arguments.length) {
      if (bufferAvailable) throw new Error("cannot change buffer length while the buffer is not empty");
      if (fillCallback) throw new Error("cannot change buffer length while the buffer is filling");
      if ((newBufferLength |= 0) <= 0) throw new Error("invalid length: " + newBufferLength);
      buffer = new Buffer(bufferLength = newBufferLength);
      return reader;
    }
    return bufferLength;
  }

  function reader_fill(callback) {
    if (error) return void process.nextTick(callback.bind(reader, error));
    if (fillCallback) throw new Error("cannot fill while a fill is already in progress");
    if (reader.ended) throw new Error("cannot fill after ended");
    if (bufferAvailable >= bufferLength) return void process.nextTick(callback.bind(reader, null));

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
    read(channel, buffer, bufferAvailable, bufferLength - bufferAvailable, function(newError, readLength) {

      // If an error occurs, stop reading, and shut it all down.
      // Or if no more bytes were available, then we’ve reached the end.
      if ((error = newError) || !readLength) {
        fillCallback = null;
        reader.ended = true;

        // Close the channel, ignoring any secondary errors.
        var oldChannel = channel;
        channel = null;
        close(oldChannel, ignore);

        return void callback(error);
      }

      // Otherwise mark the read bytes as available.
      bufferAvailable += readLength;
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
    var oldBufferOffset = bufferOffset;
    bufferAvailable -= length;
    bufferOffset += length;
    return oldBufferOffset || bufferOffset !== bufferLength
        ? buffer.slice(oldBufferOffset, bufferOffset)
        : buffer;
  }

  function reader_end(callback) {
    throw new Error("not yet implemented");
  }

  return reader;
};

// A no-op callback used to ignore secondary errors on close.
function ignore(error) {}
