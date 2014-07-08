module.exports = function(open, write, close) {
  var writer = {
        encoding: writer_encoding,
        bufferLength: writer_bufferLength,
        drain: writer_drain,
        write: writer_write,
        end: writer_end,
        ended: false
      },
      error = null,
      drainCallback = null,
      channel = null,
      encoding = "utf8",
      bufferUsed = 0,
      bufferLength = 1 << 16,
      buffers = [];

  process.nextTick(open.bind(null, function(newError, newChannel) {
    error = newError;
    channel = newChannel;
    if (drainCallback) {
      var oldDrainCallback = drainCallback;
      drainCallback = null;
      writer_drain(oldDrainCallback);
    }
  }));

  function writer_encoding(newEncoding) {
    if (arguments.length) {
      if (!Buffer.isEncoding(newEncoding = newEncoding + "")) throw new Error("unknown encoding: " + newEncoding);
      encoding = newEncoding;
      return writer;
    }
    return encoding;
  }

  function writer_bufferLength(newBufferLength) {
    if (arguments.length) {
      if (bufferUsed) throw new Error("cannot change buffer length while the buffer is not empty");
      if ((newBufferLength |= 0) <= 0) throw new Error("invalid length: " + newBufferLength);
      bufferLength = newBufferLength;
      return writer;
    }
    return bufferLength;
  }

  function writer_drain(callback) {
    if (error) return void process.nextTick(callback.bind(writer, error));
    if (drainCallback) throw new Error("cannot drain while a drain is already in progress");
    if (writer.ended) throw new Error("cannot drain after ended");
    if (!buffers.length) return void process.nextTick(callback.bind(writer, null));

    // A drain is now in-progress.
    drainCallback = callback;

    // If the channel is not yet open, wait for it.
    if (!channel) return;

    // Write each buffer, in their original order.
    buffers.reverse();
    (function writeNext(newError) {

      // If an error occurs, stop writing, and shut it all down.
      if (error = newError) {
        drainCallback = null;

        // Close the channel, ignoring any secondary errors.
        var oldChannel = channel;
        channel = null;
        close(oldChannel, ignore);

        return void callback(error);
      }

      // If there’s still data to write, write it. Otherwise callback.
      var data = buffers.pop();
      if (!data) return drainCallback = null, bufferUsed = 0, void callback(null);
      write(channel, data, 0, data.length, writeNext);
    })(null);
  }

  // Caution: the specified data must NOT be modified after draining starts.
  function writer_write(data) {
    if (error) throw error;
    if (drainCallback) throw new Error("cannot write while a drain is in progress");
    if (!(data instanceof Buffer)) data = new Buffer(data + "", encoding);
    buffers.push(data);
    bufferUsed += data.length;
    return bufferUsed < bufferLength;
  }

  function writer_end(callback) {
    if (error) throw error;
    if (drainCallback) throw new Error("cannot end while a drain is in progress");
    if (writer.ended) throw new Error("cannot end after already ended");

    // Drain any buffered bytes.
    writer_drain(function(error) {
      if (error) return void callback(error);
      writer.ended = true;

      // Close the channel.
      var oldChannel = channel;
      channel = null;
      close(oldChannel, callback);
    });
  }

  return writer;
};

// A no-op callback used to ignore secondary errors on close.
function ignore(error) {}
