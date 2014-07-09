module.exports = function() {
  var parser = {
        encoding: parser_encoding,
        push: parser_push,
        pop: parser_pop
      },
      buffer = new Buffer(0),
      bufferOffset = 0,
      bufferLength = 0,
      encoding = "utf8",
      fragments = null,
      state = STATE_DEFAULT;

  function parser_encoding(newEncoding) {
    if (!arguments.length) return encoding;
    if (buffer != null) throw new Error("cannot change encoding after pushing data");
    if (!Buffer.isEncoding(newEncoding = newEncoding + "")) throw new Error("unknown encoding: " + newEncoding);
    encoding = newEncoding;
    return parser;
  }

  function parser_push(data) {
    if (bufferOffset < bufferLength) throw new Error("cannot push before all lines are popped");
    bufferLength = data.length;
    bufferOffset = 0;
    buffer = data;
  }

  function parser_pop(allowPartial) {
    var oldBufferOffset = bufferOffset;

    // Find the next line terminator.
    while (bufferOffset < bufferLength) {
      var code = buffer[bufferOffset++];
      if (state === STATE_MAYBE_CARRIAGE_RETURN_LINE_FEED) {
        if (code === CODE_LINE_FEED) {
          state = STATE_AFTER_CARRIAGE_RETURN_LINE_FEED;
        } else {
          state = STATE_AFTER_LINE_FEED; // treat bare \r as \n
          --bufferOffset;
        }
        break;
      }
      if (code === CODE_LINE_FEED) {
        state = STATE_AFTER_LINE_FEED;
        break;
      }
      if (code === CODE_CARRIAGE_RETURN) {
        state = STATE_MAYBE_CARRIAGE_RETURN_LINE_FEED;
      }
    }

    // Slice the buffer up to the line terminator (or end of buffer).
    var afterLine = state === STATE_AFTER_LINE_FEED || state === STATE_AFTER_CARRIAGE_RETURN_LINE_FEED,
        terminatorLength = state === STATE_AFTER_CARRIAGE_RETURN_LINE_FEED ? 2 : state === STATE_DEFAULT ? 0 : 1,
        fragment = buffer.slice(oldBufferOffset, bufferOffset - terminatorLength);

    // If we read to the end of a line, return it!
    if (afterLine || allowPartial) {
      state = STATE_DEFAULT;

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

var CODE_LINE_FEED = 10,
    CODE_CARRIAGE_RETURN = 13;

var STATE_DEFAULT = 1,
    STATE_AFTER_LINE_FEED = 2,
    STATE_AFTER_CARRIAGE_RETURN_LINE_FEED = 3,
    STATE_MAYBE_CARRIAGE_RETURN_LINE_FEED = 4;
