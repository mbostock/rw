var fs = require("fs");

module.exports = function(filename, data, options, callback) {
  if (arguments.length < 3) callback = options, options = null;
  if (filename === "/dev/stdout") {
    if (typeof options === "string") options = {encoding: options};
    if (typeof data === "string") data = new Buffer(data, options && options.encoding !== null ? options.encoding : "utf8");
    try {
      // ignore broken pipe, e.g., | head -n 1000
      process.stdout.once("error", function(error) {
        if (error.code !== "EPIPE") process.stdout.emit("error", error);
      });

      // ignore broken pipe, e.g., | head -n 1000
      process.stdout.write(data, function(error) {
        callback(error.code === "EPIPE" ? null : error);
      });
    } catch (error) {
      if (error.code !== "EPIPE") throw error;
    }
  } else {
    fs.writeFile(filename, data, options, callback);
  }
};
