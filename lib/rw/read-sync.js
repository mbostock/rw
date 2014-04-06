var fs = require("fs"),
    decode = require("./decode");

module.exports = function(filename, options) {
  if (filename === "/dev/stdin") {
    var decoder = decode(options);

    while (true) {
      try {
        var buffer = new Buffer(bufferSize),
            bytesRead = fs.readSync(process.stdin.fd, buffer, 0, bufferSize);
      } catch (e) {
        if (e.code === 'EOF') break;
        throw e;
      }
      if (bytesRead === 0) break;
      decoder.push(buffer.slice(0, bytesRead));
    }

    return decoder.value();
  } else {
    return fs.readFileSync(filename, options);
  }
};

var bufferSize = 1 << 16;
