module.exports = function(writer, transform) {
  var transformed = {
    drain: transformed_drain,
    write: transformed_write,
    end: transformed_end,
    ended: writer.ended
  };

  function transformed_drain(callback) {
    writer.drain(callback);
  }

  function transformed_write(data) {
    var data = transform.write(data);
    return data == null || writer.write(data);
  }

  function transformed_end(callback) {
    var data = transform.end();
    if (data != null) writer.write(data);
    transformed.ended = true;
    writer.end(callback);
  }

  return transformed;
};
