#!/bin/sh
uglifyjs -c -m --comments /^!/ -o ../flmmlonhtml5.js flmmlonhtml5-raw.js
uglifyjs -c -m --comments /^!/ -o ../flmmlworker.js flmmlworker-raw.js
uglifyjs -c -m --comments /^!/ -o ../flmmlplayer.js flmmlplayer-raw.js
exit 0
