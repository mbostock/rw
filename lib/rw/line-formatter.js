var os = require("os");

module.exports = function() {
  var transform = {
        encoding: transform_encoding,
        write: transform_write,
        end: transform_end
      },
      encoding = "utf8";

  function transform_encoding(newEncoding) {
    if (!arguments.length) return encoding;
    if (!Buffer.isEncoding(newEncoding = newEncoding + "")) throw new Error("unknown encoding: " + newEncoding);
    encoding = newEncoding;
    return transform;
  }

  function transform_write(data) {
    return new Buffer(data + os.EOL, encoding);
  }

  function transform_end() {
    return null;
  }

  return transform;
};
