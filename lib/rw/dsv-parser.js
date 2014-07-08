module.exports = function() {
  var parser = {
        delimiter: parser_delimiter,
        encoding: parser_encoding,
        push: parser_push,
        pop: parser_pop
      },
      buffer,
      bufferOffset = 0,
      bufferLength = 0,
      encoding = "utf8",
      delimiterCode = ",".charCodeAt(0),
      row = [],
      eol = false; // is the current token followed by EOL?

  function parser_delimiter(newDelimiter) {
    if (arguments.length) {
      if (buffer != null) throw new Error("cannot change delimiter after pushing data");
      if ((newDelimiter += "").length !== 1) throw new Error("invalid delimiter: " + newDelimiter);
      delimiterCode = newDelimiter.charCodeAt(0);
      return parser;
    }
    return String.fromCharCode(delimiterCode);
  }

  function parser_encoding(newEncoding) {
    if (arguments.length) {
      if (buffer != null) throw new Error("cannot change encoding after pushing data");
      if (newEncoding == null) newEncoding = null;
      else if (!Buffer.isEncoding(newEncoding = newEncoding + "")) throw new Error("unknown encoding: " + newEncoding);
      encoding = newEncoding;
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

  function parser_token(allowPartial) {
    if (eol) return eol = false, EOL; // special case: end of line
    if (bufferOffset >= bufferLength) return null; // special case: end of file

    // special case: quotes
    var j = bufferOffset;
    if (buffer[j] === 34) {
      var i = j;
      while (i++ < bufferLength) {
        if (buffer[i] === 34) {
          if (buffer[i + 1] !== 34) break;
          ++i;
        }
      }
      bufferOffset = i + 2;
      var c = buffer[i + 1];
      if (c === 13) {
        eol = true;
        if (buffer[i + 2] === 10) ++bufferOffset;
      } else if (c === 10) {
        eol = true;
      }
      return buffer.slice(j + 1, i).toString(encoding).replace(/""/g, "\"");
    }

    // common case: find next delimiter or newline
    while (bufferOffset < bufferLength) {
      var c = buffer[bufferOffset++], k = 1;
      if (c === 10) eol = true; // \n
      else if (c === 13) { eol = true; if (buffer[bufferOffset] === 10) ++bufferOffset, ++k; } // \r|\r\n
      else if (c !== delimiterCode) continue;
      return buffer.slice(j, bufferOffset - k).toString(encoding);
    }

    // special case: last token before end of buffer
    return allowPartial
        ? (eol = true, buffer.slice(j).toString(encoding))
        : (bufferOffset = j, null);
  }

  function parser_pop(allowPartial) {
    var token;

    while ((token = parser_token(allowPartial)) != null) {
      if (token === EOL) {
        var oldRow = row;
        row = [];
        return oldRow;
      } else {
        row.push(token);
      }
    }

    return null;
  }

  return parser;
};

var EOL = {}; // sentinel value for end-of-line
