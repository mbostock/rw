var fs = require("fs");

var writer = require("./writer");

module.exports = function(filePath) {
  return writer(
    function open(callback) {
      fs.open(filePath, "w", 438 /*=0666*/, callback);
    },
    write,
    close
  );
};

// if (error_ && error_.code === "EPIPE") error_ = null; // TODO ignore broken pipe and ignore subsequent writes
function write(channel, buffer, bufferOffset, bufferLength, callback) {
  fs.write(channel, buffer, bufferOffset, bufferLength, null, function(error, writeLength) {
    if (error) return void callback(error);
    if (writeLength < bufferLength) return void write(channel, buffer, bufferOffset + writeLength, bufferLength - writeLength, callback);
    callback(null);
  });
}

function close(descriptor, callback) {
  fs.close(descriptor, callback);
}
