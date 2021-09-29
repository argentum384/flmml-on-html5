const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

const webpack = require("webpack");
const pjson = require("./package.json");
const TerserPlugin = require("terser-webpack-plugin");

const licenseAuthor = `(c) 2015, ${pjson.author} (c) 2007, Takeshi OKUBO`;

module.exports = merge(common, {
    mode: "production",
    plugins: [
        new webpack.BannerPlugin({
            banner: `${pjson.name} v${pjson.version} | ${licenseAuthor} | ${pjson.license} | ${pjson.homepage}`
        })
    ],
    optimization: {
        minimizer: [new TerserPlugin({
            extractComments: false,
        })]
    }
});
