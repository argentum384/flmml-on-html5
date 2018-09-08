rem **** For Windows installed Node.js and UglifyJS ****
cmd /c "uglifyjs -c -m --comments /^!/ -o ../flmmlonhtml5.js flmmlonhtml5-raw.js"
cmd /c "uglifyjs -c -m --comments /^!/ -o ../flmmlworker.js flmmlworker-raw.js"
cmd /c "uglifyjs -c -m --comments /^!/ -o ../flmmlplayer.js flmmlplayer-raw.js"
pause
