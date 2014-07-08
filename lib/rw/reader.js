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
    if (!arguments.length) return bufferLength;
    if (bufferAvailable) throw new Error("cannot change buffer length while the buffer is not empty");
    if (fillCallback) throw new Error("cannot change buffer length while the buffer is filling");
    if ((newBufferLength |= 0) <= 0) throw new Error("invalid length: " + newBufferLength);
    buffer = new Buffer(bufferLength = newBufferLength);
    return reader;
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
      fillCallback = null;

      // If an error occurs, stop reading, and shut it all down.
      // Or if no more bytes were available, then we’ve reached the end.
      if ((error = newError) || !readLength) {
        reader.ended = true;

        // Close the channel, ignoring any secondary errors.
        var oldChannel = channel;
        channel = null;
        close(oldChannel, ignore);

        return void callback(error);
      }

      // Otherwise mark the read bytes as available.
      bufferAvailable += readLength;
      callback(null);
    });
  }

  // Note: the returned data may not be read after the reader starts filling.
  function reader_read(length) {
    if (error) throw error;
    if (fillCallback) throw new Error("cannot read while a fill is in progress");
    if (length == null) length = bufferAvailable;
    else if ((length |= 0) <= 0) throw new Error("invalid length: " + length);

    // If all the requested bytes are not available, return null.
    if (!bufferAvailable || length > bufferAvailable) return null;

    // Otherwise, return the next slice of bytes from the buffer.
    var oldBufferOffset = bufferOffset;
    bufferAvailable -= length;
    bufferOffset += length;
    return oldBufferOffset || bufferOffset !== bufferLength
        ? buffer.slice(oldBufferOffset, bufferOffset)
        : buffer;
  }

  function reader_end(callback) {
    if (error) throw error;
    if (fillCallback) throw new Error("cannot end while a fill is in progress");
    if (reader.ended) throw new Error("cannot end after already ended");
    reader.ended = true;

    // Close the channel.
    var oldChannel = channel;
    channel = null;
    close(oldChannel, callback);
  }

  return reader;
};

// A no-op callback used to ignore secondary errors on close.
function ignore(error) {}
