module.exports = function() {
  var parser = {
        encoding: parser_encoding,
        push: parser_push,
        pop: parser_pop
      },
      buffer,
      bufferOffset = 0,
      bufferLength = 0,
      encoding = "utf8",
      fragments = null;

  function parser_encoding(encoding_) {
    if (arguments.length) {
      if (buffer != null) throw new Error("cannot change encoding after pushing data");
      if (encoding_ == null) encoding_ = null;
      else if (!Buffer.isEncoding(encoding_ = encoding_ + "")) throw new Error("unknown encoding: " + encoding_);
      encoding = encoding_;
      return parser;
    }
    return encoding;
  }

  function parser_push(data) {
    if (bufferOffset < bufferLength) throw new Error("cannot push before all lines are popped");
    bufferLength = data.length;
    bufferOffset = 0;
    buffer = data;
  }

  function parser_pop(allowPartial) {
    var bufferOffset0 = bufferOffset,
        terminatorLength = 0;

    // Find the next line terminator.
    while (bufferOffset < bufferLength) {
      var character = buffer[bufferOffset++];
      if (character === 10) { // \n
        ++terminatorLength;
        break;
      }
      if (character === 13) { // \r or \r\n
        ++terminatorLength;
        if (buffer[bufferOffset] === 10) ++bufferOffset, ++terminatorLength;
        break;
      }
    }

    // Slice the buffer up to the line terminator.
    var fragment = buffer.slice(bufferOffset0, bufferOffset - terminatorLength);

    // If we read to the end of a line, return it!
    if (terminatorLength || allowPartial) {

      // Combine this with previously-read line fragments, if any.
      if (fragments) {
        fragments.push(fragment);
        fragment = Buffer.concat(fragments);
        fragments = null;
      }

      // If this is the last line in a file not terminated with a new line,
      // then return the line even though there’s no trailing terminator.
      return !allowPartial || fragment.length ? fragment.toString(encoding) : null;
    }

    // Otherwise, we’ve read part of a line. Copy the fragment so that the
    // source buffer can be modified without changing the fragment contents.
    var fragmentCopy = new Buffer(fragment.length);
    fragment.copy(fragmentCopy);
    if (fragments) fragments.push(fragmentCopy);
    else fragments = [fragmentCopy];
    return null;
  }

  return parser;
};
