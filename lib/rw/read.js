var fs = require("fs"),
    decode = require("./decode");

module.exports = function(filename, options, callback) {
  if (arguments.length < 2) callback = options, options = null;
  if (filename === "/dev/stdin") {
    var decoder = decode(options);
    process.stdin
        .on("error", callback)
        .on("data", function(d) { decoder.push(d); })
        .on("end", function() { callback(null, decoder.value()); });
  } else {
    fs.readFile(filename, options, callback);
  }
};
