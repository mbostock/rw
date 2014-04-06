var fs = require("fs");

module.exports = function(filename, data, options) {
  if (filename === "/dev/stdout") {
    if (typeof options === "string") options = {encoding: options};
    if (typeof data === "string") data = new Buffer(data, options && options.encoding !== null ? options.encoding : "utf8");
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
