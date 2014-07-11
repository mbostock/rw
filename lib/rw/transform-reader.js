module.exports = function(reader, transform) {
  var transformed = {
    fill: transformed_fill,
    read: transformed_read,
    end: transformed_end,
    ended: reader.ended
  };

  function transformed_fill(callback) {
    reader.fill(function(error) {
      if (error) return void callback(error);
      var data = reader.read();
      if (data != null) transform.fill(data);
      transformed.ended = reader.ended;
      callback(null);
    });
  }

  function transformed_read(allowPartial) {
    return transform.read(allowPartial);
  }

  function transformed_end(callback) {
    transformed.ended = true;
    reader.end(callback);
  }

  return transformed;
};
