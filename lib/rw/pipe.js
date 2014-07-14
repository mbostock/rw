var reader = require("./reader"),
    writer = require("./writer");

module.exports = function() {
  var r = reader(open, reader_read, close),
      w = writer(open, writer_write, close),
      pipe = {
        encoding: pipe_encoding,
        readBufferLength: pipe_readBufferLength,
        writeBufferLength: pipe_writeBufferLength,
        fill: r.fill,
        read: r.read,
        drain: w.drain,
        write: w.write,
        end: pipe_end,
        ended: false
      },
      writeBuffer,
      writeOffset,
      writeLength,
      writeCallback,
      readBuffer,
      readOffset,
      readLength,
      readWriteLength,
      readCallback;

  function pipe_end(callback) {
    pipe.ended = true;
    w.end(callback);
  }

  function pipe_encoding(_) {
    return arguments.length ? (w.encoding(_), pipe) : w.encoding();
  }

  function pipe_readBufferLength(_) {
    return arguments.length ? (r.bufferLength(_), pipe) : r.bufferLength();
  }

  function pipe_writeBufferLength(_) {
    return arguments.length ? (w.bufferLength(_), pipe) : w.bufferLength();
  }

  function writer_write(channel, buffer, offset, length, callback) {

    // If there’s a pending read request…
    if (readCallback) {

      // If the writer is closed, we won’t read any more bytes.
      if (w.ended && readLength > length) readLength = length;

      // Copy up to the requested bytes from the write to the read buffer.
      var copyLength = Math.min(length, readLength);
      buffer.copy(readBuffer, readOffset, offset, copyLength);
      readOffset += copyLength;
      readLength -= copyLength;
      readWriteLength += copyLength;
      offset += copyLength;
      length -= copyLength;

      // If the pending read was fulfilled by this write,
      // notify the read callback.
      if (readLength <= 0) {
        process.nextTick(readCallback.bind(null, null, readWriteLength));
        readCallback = null;
      }

      // If this write was fulfilled by the pending read,
      // notify the write callback.
      if (length <= 0) return void process.nextTick(callback.bind(null, null));
    }

    // Otherwise, not all of the bytes could be immediately written.
    // Set a write callback and wait for the next read.
    if (writeCallback) throw new Error("didn’t finish previous write");
    writeBuffer = buffer;
    writeOffset = offset;
    writeLength = length;
    writeCallback = callback;
  }

  function reader_read(channel, buffer, offset, length, callback) {

    // If there’s a pending write request…
    if (writeCallback) {

      // If the writer is closed, we won’t read any more bytes.
      if (w.ended && length > writeLength) length = writeLength;

      // Copy up to the requested bytes from the write to the read buffer.
      var copyLength = Math.min(writeLength, length);
      writeBuffer.copy(buffer, offset, writeOffset, copyLength);
      writeOffset += copyLength;
      writeLength -= copyLength;
      readWriteLength += copyLength;
      offset += copyLength;
      length -= copyLength;

      // If the pending write was fullfilled by this read,
      // notify the write callback.
      if (writeLength <= 0) {
        process.nextTick(writeCallback.bind(null, null));
        writeCallback = null;
      }

      // If this read was fulfilled by the pending write,
      // notify the read callback.
      if (length <= 0) return void process.nextTick(callback.bind(null, null, readWriteLength));
    }

    // If the writer is closed, we won’t be able to read any more bytes.
    if (w.ended) return void process.nextTick(callback.bind(null, null, 0));

    // Otherwise, not all of the bytes could be immediately read.
    // Set a read callback and wait for the next write.
    if (readCallback) throw new Error("didn’t finish previous read");
    readBuffer = buffer;
    readOffset = offset;
    readLength = length;
    readWriteLength = 0;
    readCallback = callback;
  }

  return pipe;
};

function open(callback) {
  process.nextTick(callback.bind(null, null));
}

function close(channel, callback) {
  process.nextTick(callback.bind(null, null));
}
