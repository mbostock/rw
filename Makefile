.PHONY: all clean test

all:

clean:

test/input.txt:
	yes 123456789 | head -n 10000 > $@

test: test/input.txt
	cat $< | test/cat | head -n 100 | test/wc
