var fs = require("fs"),
    encode = require("./encode");

module.exports = function(filename, data, options) {
  if (filename === "/dev/stdout") {
    data = encode(data, options);
    var bytesWritten = 0,
        bytesTotal = data.length;

    while (bytesWritten < bytesTotal) {
      try {
        bytesWritten += fs.writeSync(process.stdout.fd, data, bytesWritten, bytesTotal - bytesWritten, null);
      } catch (error) {
        if (error.code === "EPIPE") break; // ignore broken pipe, e.g., | head -n 1000
        throw error;
      }
    }
  } else {
    fs.writeFileSync(filename, data, options);
  }
};
