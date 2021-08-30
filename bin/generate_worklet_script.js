const path = require("path");
const fs = require("fs");
const { minify } = require("terser");

const srcPath = path.join(__dirname, "..", "src", "flmml-on-html5.worklet.js");
const destPath = path.join(__dirname, "..", "src_generated", "FlMMLWorkletScript.js");
const destVarName = "FlMMLWorkletScript";

const srcCode = fs.readFileSync(srcPath, "utf8");

const generate = ({ code }) => {
    const destCode = [
        "export const ",
        destVarName,
        " = `",
        code,
        "`;\n"
    ].join("");

    if (!fs.existsSync(path.dirname(destPath))) {
        fs.mkdirSync(path.dirname(destPath));
    }
    fs.writeFileSync(destPath, destCode, "utf8");
};

// Production
if (process.argv.slice(2).includes("--prod")) {
    minify(srcCode).then(generate);
}
// Development
else {
    generate({ code: srcCode });
}
