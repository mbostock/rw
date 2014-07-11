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
      bufferOverflowLength = bufferLength << 1,
      buffer = new Buffer(bufferOverflowLength);

  function writer_open() {
    open(function(newError, newChannel) {
      if (!(error = newError) && ((channel = newChannel) == null)) error = new Error("channel is null");
      var oldDraomCallback = drainCallback;
      drainCallback = null;
      writer_drain(oldDraomCallback);
    });
  }

  function writer_encoding(newEncoding) {
    if (!arguments.length) return encoding;
    if (!Buffer.isEncoding(newEncoding = newEncoding + "")) throw new Error("unknown encoding: " + newEncoding);
    encoding = newEncoding;
    return writer;
  }

  function writer_bufferLength(newBufferLength) {
    if (!arguments.length) return bufferLength;
    if (bufferUsed) throw new Error("cannot change buffer length while the buffer is not empty");
    if ((newBufferLength |= 0) <= 0) throw new Error("invalid length: " + newBufferLength);
    bufferLength = newBufferLength;
    bufferOverflowLength = bufferLength << 1;
    buffer = new Buffer(bufferOverflowLength);
    return writer;
  }

  function writer_drain(callback) {
    if (error) return void process.nextTick(callback.bind(null, error));
    if (drainCallback) throw new Error("cannot drain while a drain is already in progress");
    if (writer.ended) throw new Error("cannot drain after ended");
    if (!callback) throw new Error("missing callback");
    if (channel == null) return drainCallback = callback, void writer_open();
    if (!bufferUsed) return void process.nextTick(callback.bind(null, null));

    // A drain is now in-progress.
    drainCallback = callback;

    // If the channel is not yet open, wait for it.
    if (!channel) return;

    // Write out the buffer.
    write(channel, buffer, 0, bufferUsed, function(newError) {
      drainCallback = null;

      // If an error occurs, close, ignoring any secondary errors.
      if (error = newError) return void close(channel, callback.bind(null, error));

      bufferUsed = 0;
      callback(null);
    });
  }

  function writer_write(data) {
    if (error) throw error;
    if (drainCallback) throw new Error("cannot write while a drain is in progress");
    if (writer.ended) throw new Error("cannot write after ended");
    if (!(data instanceof Buffer)) data = new Buffer(data + "", encoding);
    var oldBufferUsed = bufferUsed;
    bufferUsed += data.length;

    // If the buffer would overflow with this new data, double its size.
    if (bufferUsed > bufferOverflowLength) {
      var oldBuffer = buffer;
      buffer = new Buffer(bufferOverflowLength <<= 1);
      oldBuffer.copy(buffer, 0, 0, oldBufferUsed);
    }

    // Combining multiple buffers into a single buffer is much faster than
    // myriad tiny writes. In addition, this copies the data to be written,
    // isolating it from any external changes (such as the reader refilling).
    data.copy(buffer, oldBufferUsed);

    return bufferUsed < bufferLength;
  }

  function writer_end(callback) {
    if (error) throw error;
    if (drainCallback) throw new Error("cannot end while a drain is in progress");
    if (writer.ended) throw new Error("cannot end after already ended");
    if (!callback) callback = rethrow;

    // Drain any buffered bytes, then close the channel.
    writer_drain(function(error) {
      if (error) return void callback(error);
      writer.ended = true;
      close(channel, callback);
    });
  }

  return writer;
};

function rethrow(error) {
  if (error) throw error;
}
