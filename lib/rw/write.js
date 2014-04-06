var fs = require("fs"),
    encode = require("./encode");

module.exports = function(filename, data, options, callback) {
  if (arguments.length < 3) callback = options, options = null;
  if (filename === "/dev/stdout") {
    data = encode(data, options);
    try {
      process.stdout.write(data, function(error) {
        if (error && error.code === "EPIPE") { // ignore broken pipe, e.g., | head -n 1000
          error = null;
          process.stdout.once("error", function() {});
        }
        callback(error);
      });
    } catch (error) {
      if (error.code !== "EPIPE") throw error;
    }
  } else {
    fs.writeFile(filename, data, options, callback);
  }
};
