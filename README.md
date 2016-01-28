# rw - Now stdin and stdout are files.

How do you read a file from stdin? If you thought,

```js
var contents = fs.readFileSync("/dev/stdin", "utf8");
```

you’d be wrong, because Node only reads up to the size of the file reported by fs.stat rather than reading until it receives an EOF. So, if you redirect a file to your program (`cat file | program`), you’ll only read the first 65,536 bytes of your file. Oops.

What about writing a file to stdout? If you thought,

```js
fs.writeFileSync("/dev/stdout", contents, "utf8");
```

you’d also be wrong, because this tries to close stdout, so you get this error:

```
Error: UNKNOWN, unknown error
    at Object.fs.writeSync (fs.js:528:18)
    at Object.fs.writeFileSync (fs.js:975:21)
```

Shucks. So what should you do?

You could use a different pattern for reading from stdin:

```js
var chunks = [];

process.stdin
    .on("data", function(chunk) { chunks.push(chunk); })
    .on("end", function() { console.log(chunks.join("").length); })
    .setEncoding("utf8");
```

But that’s a pain, since now your code has two different code paths for reading inputs depending on whether you’re reading a real file or stdin. And the code gets even more complex if you want to [read that file synchronously](https://github.com/mbostock/rw/blob/master/lib/rw/read-file-sync.js).

You could also try a different pattern for writing to stdout:

```js
process.stdout.write(contents);
```

Or even:

```js
console.log(contents);
```

But if you try to pipe your output to `head`, you’ll get this error:

```
Error: write EPIPE
    at errnoException (net.js:904:11)
    at Object.afterWrite (net.js:720:19)
```

Huh.

The **rw** module fixes these problems. It provides an interface just like readFile, readFileSync, writeFile and writeFileSync, but with implementations that work the way you expect on stdin and stdout. If you use these methods on files other than /dev/stdin or /dev/stdout, they simply delegate to the fs methods, so you can trust that they behave identically to the methods you’re used to.

For example, now you can read stdin synchronously like so:

```js
var contents = rw.readFileSync("/dev/stdin", "utf8");
```

Or to write to stdout:

```js
rw.writeFileSync("/dev/stdout", contents, "utf8");
```

And rw automatically squashes EPIPE errors, so you can pipe the output of your program to `head` and you won’t get a spurious stack trace.

To install, `npm install rw`.

## API Reference

<a name="readFile" href="#readFile">#</a> rw.<b>readFile</b>(<i>path</i>[, <i>options</i>], <i>callback</i>)

Reads the file at the specified *path* completely into memory, invoking the specified *callback* once the data is available and the file is closed. The *callback* is invoked with two arguments: the *error* that occurred during read (hopefully null), and the read data. If *options* is a string, it specifies the encoding to use, in which case the read data will be a string; otherwise *options* is an object, and may specify encoding and flag properties. This method is a drop-in replacement for [fs.readFile](https://nodejs.org/api/fs.html#fs_fs_readfile_file_options_callback) and fixes the behavior of special files such as /dev/stdin.

<a name="readFileSync" href="#readFileSync">#</a> rw.<b>readFileSync</b>(<i>path</i>[, <i>options</i>])

Reads the file at the specified *path* completely into memory, synchronously, returning the data. If an error occurred during read, this function throws an error instead. If *options* is a string, it specifies the encoding to use, in which case the read data will be a string; otherwise *options* is an object, and may specify encoding and flag properties. This method is a drop-in replacement for [fs.readFileSync](https://nodejs.org/api/fs.html#fs_fs_readfilesync_file_options) and fixes the behavior of special files such as /dev/stdin.

<a name="writeFile" href="#writeFile">#</a> rw.<b>writeFile</b>(<i>path</i>, <i>data</i>[, <i>options</i>], <i>callback</i>)

Writes the specified *data* (completely in memory) to a file at the specified *path*, invoking the specified *callback* once the data is completely written and the file is closed. The *callback* is invoked with a single argument: the *error* that occurred during write (hopefully null). If *options* is a string, it specifies the encoding to use, in which case the *data* must be a string; otherwise *options* is an object, and may specify encoding, mode and flag properties. This method is a drop-in replacement for [fs.writeFile](https://nodejs.org/api/fs.html#fs_fs_writefile_file_data_options_callback) and fixes the behavior of special files such as /dev/stdout.

<a name="writeFileSync" href="#writeFileSync">#</a> rw.<b>writeFileSync</b>(<i>path</i>, <i>data</i>[, <i>options</i>])

Writes the specified *data* (completely in memory) to a file at the specified *path*, synchronously, returning once the data is completely written and the file is closed. Throws an *error* if one occurs during write. If *options* is a string, it specifies the encoding to use, in which case the *data* must be a string; otherwise *options* is an object, and may specify encoding, mode and flag properties. This method is a drop-in replacement for [fs.writeFileSync](https://nodejs.org/api/fs.html#fs_fs_writefilesync_file_data_options) and fixes the behavior of special files such as /dev/stdout.
