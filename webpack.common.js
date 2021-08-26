const path = require("path");

module.exports = {
    entry: {
        "flmml-on-html5": "./src/flmml-on-html5.ts",
        "flmml-on-html5.worker": "./src/flmml-on-html5.worker.ts"
    },
    output: {
        path: path.join(__dirname, "dist"),
        publicPath: "/dist",
        filename: "[name].js",
        library: {
            type: "umd"
        }
    },
    module: {
        rules: [
            { test: /\.ts$/, use: "ts-loader" }
        ]
    },
    resolve: {
        extensions: [".ts", ".js"]
    }
};
