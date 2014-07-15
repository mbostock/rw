var fs = require("fs");

var reader = require("./reader");

module.exports = function(stream) {
  var errorCallback,
      readLength,
      readBuffer,
      readOffset,
      readableCallback,
      closeCallback;

  stream
      .on("error", errored)
      .on("readable", readabled)
      .on("end", readabled)
      .on("close", closed);

  function errored() {
    var callback = errorCallback;
    errorCallback = readableCallback = closeCallback = null;
    callback(null);
  }

  function readabled() {
    if (!readableCallback) return;

    if (stream.readable) {
      var data = stream.read(readLength);
      if (data == null) return;
      data.copy(readBuffer, readOffset);
      readLength = data.length;
    } else {
      readLength = 0;
    }

    var callback = readableCallback;
    errorCallback = readableCallback = null;
    callback(null, readLength);
  }

  function closed() {
    var callback = closeCallback;
    errorCallback = closeCallback = null;
    callback(null);
  }

  return reader(
    function open(callback) {
      process.nextTick(callback.bind(null, null, stream));
    },
    function read(stream, buffer, offset, length, callback) {
      var data = stream.read(length);

      if (data == null) {
        readBuffer = buffer;
        readOffset = offset;
        readLength = length;
        errorCallback = readableCallback = callback;
        return;
      }

      data.copy(buffer, offset);
      process.nextTick(callback.bind(null, null, length));
    },
    function close(stream, callback) {
      errorCallback = closeCallback = callback;
      stream.close();
    }
  );
};
