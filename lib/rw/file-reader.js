var fs = require("fs");

var reader = require("./reader");

module.exports = function(filePath) {
  return reader(
    function open(callback) {
      fs.open(filePath, "r", 438 /*=0666*/, callback);
    },
    read,
    close
  );
};

function read(descriptor, buffer, bufferOffset, bufferLength, callback) {
  fs.read(descriptor, buffer, bufferOffset, bufferLength, null, callback);
}

function close(descriptor, callback) {
  fs.close(descriptor, callback);
}
