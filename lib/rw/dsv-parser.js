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
      state = STATE_IN_FIELD,
      lineEmpty = true,
      tokenOffset = 0,
      tokenDefaultLength = 1 << 7,
      tokenLength = tokenDefaultLength,
      token = new Buffer(tokenLength);

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

  // TODO Optimize special case of non-quoted, not-fragmented field.
  function parser_token(allowPartial) {
    if (bufferOffset > bufferLength) return null;

    while (bufferOffset < bufferLength) {
      var character = buffer[bufferOffset++];
      if (state === STATE_IN_FIELD) {
        if (character === CODE_QUOTE) { // entered a quoted value
          state = STATE_IN_QUOTE;
          lineEmpty = false;
        } else if (character === CODE_CARRIAGE_RETURN) { // possible CRLF
          state = STATE_AFTER_CARRIAGE_RETURN;
        } else if (character === CODE_LINE_FEED) { // ended an unquoted field & row
          state = STATE_END_OF_LINE;
          return tokenEnd();
        } else if (character === delimiterCode) { // ended an unquoted field
          lineEmpty = false;
          return tokenEnd();
        } else { // read an unquoted character
          lineEmpty = false;
          tokenCharacter(character);
          continue;
        }
      } else if (state === STATE_IN_QUOTE) {
        if (character === CODE_QUOTE) { // read a quote within a quoted value
          state = STATE_AFTER_QUOTE_IN_QUOTE;
        } else { // read a quoted character
          tokenCharacter(character);
          continue;
        }
      } else if (state === STATE_AFTER_QUOTE_IN_QUOTE) {
        if (character === CODE_QUOTE) { // read a quoted quote
          state = STATE_IN_QUOTE;
          tokenCharacter(CODE_QUOTE);
        } else { // exited a quoted value
          state = STATE_IN_FIELD;
          --bufferOffset;
        }
      } else if (state === STATE_AFTER_CARRIAGE_RETURN) {
        state = STATE_IN_FIELD;
        if (character === CODE_LINE_FEED) {
          return tokenEnd();
        } else {
          --bufferOffset;
        }
      }
    }

    if (allowPartial) {
      state = STATE_END_OF_LINE;
      ++bufferOffset;
      return tokenEnd();
    }

    return null;
  }

  function tokenCharacter(character) {
    if (tokenOffset >= tokenLength) {
      var oldToken = token;
      token = new Buffer(tokenLength <<= 1);
      oldToken.copy(token);
    }
    token[tokenOffset++] = character;
  }

  function tokenEnd() {
    var oldToken = token.slice(0, tokenOffset);
    token = new Buffer(tokenLength = tokenDefaultLength);
    tokenOffset = 0;
    return oldToken;
  }

  function parser_pop(allowPartial) {
    var token;

    while ((token = parser_token(allowPartial)) != null) {
      row.push(token.toString(encoding));
      if (state === STATE_END_OF_LINE) {
        state = STATE_IN_FIELD;
        var oldRow = row,
            oldLineEmpty = lineEmpty;
        row = [];
        lineEmpty = true;
        if (oldLineEmpty) continue; // skip empty lines
        return oldRow;
      }
    }

    return null;
  }

  return parser;
};

var CODE_QUOTE = 34,
    CODE_LINE_FEED = 10,
    CODE_CARRIAGE_RETURN = 13;

var STATE_IN_FIELD = 1, // inside an unquoted value
    STATE_IN_QUOTE = 2, // inside a quoted value
    STATE_AFTER_QUOTE_IN_QUOTE = 3, // after a quote in a quoted value (")
    STATE_AFTER_CARRIAGE_RETURN = 4, // after a carriage return in an unquoted value
    STATE_END_OF_LINE = 5; // after the last field in a line has been read
