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
      state = STATE_FIELD,
      fragment = null,
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
    // if (bufferOffset >= bufferLength) return null; // special case: end of file
    var oldBufferOffset = bufferOffset;

    while (bufferOffset < bufferLength) {
      var character = buffer[bufferOffset++];

      if (state === STATE_FIELD) {
        if (character === CODE_QUOTE) {
          state = STATE_QUOTE; // entering a quoted value
        } else if (character === CODE_CARRIAGE_RETURN) {
          state = STATE_CARRIAGE_RETURN; // the current (last) field has ended, but may be followed by a skippable line feed
        } else if (character === CODE_LINE_FEED) {
          throw new Error("not yet implemented"); // the current (last) field has ended
        } else if (character === delimiterCode) {
          throw new Error("not yet implemented"); // the current (non-last) field has ended
        } else {
          continue; // read an unquoted character
        }
      } else if (state === STATE_QUOTE) {
        if (character === CODE_QUOTE) {
          state = STATE_QUOTED_QUOTE; // read another quote; may end the quoted value, or be a quoted quote
        } else {
          continue; // read a quoted character
        }
      } else if (state === STATE_QUOTED_QUOTE) {
        if (character === CODE_QUOTE) {
          state = STATE_QUOTE; // read a quoted code (TODO strip the extra quotes)
        } else {
          state = STATE_FIELD; // read an unquoted character; the quoted value has ended
        }
      } else if (state === STATE_CARRIAGE_RETURN) {
        if (character === CODE_LINE_FEED) {
          throw new Error("not yet implemented"); // the CR was followed by an LF, and is skipped
        } else {
          throw new Error("not yet implemented"); // the CR wasn’t followed by an LF, and is the first character of a new field
          --bufferOffset; // rewind and re-read this character
        }
        state = STATE_FIELD;
      } else {
        throw new Error("unknown state");
      }
    }

    // // special case: quotes
    // var j = bufferOffset;
    // if (buffer[j] === 34) {
    //   var i = j;
    //   while (i++ < bufferLength) {
    //     if (buffer[i] === 34) {
    //       if (buffer[i + 1] !== 34) break;
    //       ++i;
    //     }
    //   }
    //   bufferOffset = i + 2;
    //   var c = buffer[i + 1];
    //   if (c === 13) {
    //     eol = true;
    //     if (buffer[i + 2] === 10) ++bufferOffset;
    //   } else if (c === 10) {
    //     eol = true;
    //   }
    //   return buffer.slice(j + 1, i).toString(encoding).replace(/""/g, "\"");
    // }

    // // common case: find next delimiter or newline
    // while (bufferOffset < bufferLength) {
    //   var c = buffer[bufferOffset++], k = 1;
    //   if (c === 10) eol = true; // \n
    //   else if (c === 13) { eol = true; if (buffer[bufferOffset] === 10) ++bufferOffset, ++k; } // \r|\r\n
    //   else if (c !== delimiterCode) continue;
    //   return buffer.slice(j, bufferOffset - k).toString(encoding);
    // }

    // // special case: last token before end of buffer
    // return allowPartial
    //     ? (eol = true, buffer.slice(j).toString(encoding))
    //     : (bufferOffset = j, null);
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

var CODE_QUOTE = 34,
    CODE_LINE_FEED = 10,
    CODE_CARRIAGE_RETURN = 13;

var STATE_FIELD = 1, // inside an unquoted value
    STATE_QUOTE = 2, // inside a quoted value
    STATE_QUOTED_QUOTE = 3, // inside a quoted quote (""")
    STATE_CARRIAGE_RETURN = 4; // inside an unquoted CRLF (\r\n)
