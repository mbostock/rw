module.exports = function() {
  var transform = {
        encoding: transform_encoding,
        write: transform_write,
        end: transform_end
      },
      encoding = "utf8",
      first = true;

  function transform_encoding(newEncoding) {
    if (!arguments.length) return encoding;
    if (!Buffer.isEncoding(newEncoding = newEncoding + "")) throw new Error("unknown encoding: " + newEncoding);
    encoding = newEncoding;
    return transform;
  }

  function transform_write(data) {
    return new Buffer((first ? (first = false, "[") : ",") + JSON.stringify(data), encoding);
  }

  function transform_end() {
    return new Buffer("]", encoding);
  }

  return transform;
};
