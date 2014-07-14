var reader = require("./reader"),
    writer = require("./writer");

module.exports = function() {
  var r = reader(bridge_open, reader_read, bridge_close),
      w = writer(bridge_open, writer_write, bridge_close),
      bridge = {
        fill: r.fill,
        read: r.read,
        drain: w.drain,
        write: w.write,
        end: bridge_end,
        ended: false
      },
      writeBuffer = new Buffer(0),
      writeOffset = 0,
      writeLength = 0,
      writeCallback,
      readBuffer = new Buffer(0),
      readOffset = 0,
      readLength = 0,
      readTotal = 0,
      readCallback;

  function bridge_open(callback) {
    process.nextTick(callback.bind(null, null));
  }

  function bridge_end(callback) {
    bridge.ended = true;

    if (writeCallback) throw new Error("didn’t finish previous write");

    w.end(function(error) {
      if (error) return void callback(error);
      if (readCallback) {
        var oldReadCallback = readCallback,
            oldReadTotal = readTotal;
        readCallback = null;
        readTotal = 0;
        oldReadCallback(null, oldReadTotal);
      }
      if (callback) callback(null);
    });
  }

  function writer_write(channel, buffer, offset, length, callback) {
    if (readLength > 0) {
      if (readLength > length) {
        buffer.copy(readBuffer, offset, readOffset, length);
        readOffset += length;
        readLength -= length;
        readTotal += length;
        process.nextTick(callback.bind(null, null));
        return;
      }
      if (readLength === length) {
        buffer.copy(readBuffer, offset, readOffset, length);
        readOffset += length;
        readLength = 0;
        readTotal += length;
        var oldReadCallback = readCallback;
        readCallback = null;
        process.nextTick(callback.bind(null, null));
        oldReadCallback(null);
        return;
      }
      if (writeCallback) throw new Error("didn’t finish previous write");
      if (readLength < length) {
        writeBuffer = buffer;
        writeOffset = offset + readLength;
        writeLength = length - readLength;
        writeCallback = callback;
        buffer.copy(readBuffer, offset, readOffset, readLength);
        readTotal += readLength;
        readLength = 0;
        var oldReadCallback = readCallback,
            oldReadTotal = readTotal;
        readCallback = null;
        readTotal = 0;
        oldReadCallback(null, oldReadTotal);
        return;
      }
    }
    writeBuffer = buffer;
    writeOffset = offset;
    writeLength = length;
    writeCallback = callback;
  }

  function reader_read(channel, buffer, offset, length, callback) {
    if (writeLength > 0) {
      if (writeLength > length) {
        writeBuffer.copy(buffer, offset, writeOffset, length);
        writeOffset += length;
        writeLength -= length;
        process.nextTick(callback.bind(null, null));
        return;
      }
      if (writeLength === length) {
        writeBuffer.copy(buffer, offset, writeOffset, length);
        writeOffset += length;
        writeLength = 0;
        var oldWriteCallback = writeCallback;
        writeCallback = null;
        process.nextTick(callback.bind(null, null));
        oldWriteCallback(null);
        return;
      }
      if (readCallback) throw new Error("didn’t finish previous read");
      if (writeLength < length) {
        readBuffer = buffer;
        readOffset = offset + writeLength;
        readLength = length - writeLength;
        readCallback = callback;
        readTotal = 0;
        writeBuffer.copy(buffer, offset, writeOffset, writeLength);
        writeLength = 0;
        var oldWriteCallback = writeCallback;
        writeCallback = null;
        oldWriteCallback(null);
        return;
      }
    }
    readBuffer = buffer;
    readOffset = offset;
    readLength = length;
    readCallback = callback;
    readTotal = 0;
  }

  function bridge_close(channel, callback) {
    process.nextTick(callback.bind(null, null));
  }

  return bridge;
};
