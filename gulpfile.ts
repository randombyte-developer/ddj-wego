type CB = (err?: any) => any;

const {src, dest, parallel, series, task} = require("gulp");
const shell = require("gulp-shell");
const rollup = require("rollup");
const {uglify} = require("rollup-plugin-uglify");
const babel = require("rollup-plugin-babel");
const sourcemaps = require("rollup-plugin-sourcemaps");
const pkg = require("./package.json");
const path = require("path");

const camelish = (str: string) => str.replace(/[-_@\/]+([A-Za-z])/g, (_, x) => x.toUpperCase());
const pascal   = (str: string) => { const cam = camelish(str); return cam[0].toUpperCase() + cam.substr(1); };

const dirs = {
  entryTs: "src",
  entryJs: "lib",
  output:  "dist",
};
Object.entries(dirs).forEach(([name, file]) => (dirs as any)[name] = path.resolve(__dirname, file));

const files = {
  entryTs:   "src/ddj-wego.ts",
  entryJs:   "lib/ddj-wego.js",
  outputIife: "dist/ddj-wego.js",
  outputMin:  "dist/ddj-wego.min.js",
};
Object.entries(files).forEach(([name, file]) => (files as any)[name] = path.resolve(__dirname, file));

const banner = "";

const rollupInput = {
  input: files.entryJs,
  external: Object.keys(pkg.dependencies || {}),
  plugins: [
    sourcemaps()
  ],
  onwarn: (...args: any[]) => !/Non-existent export/.test(args[0]) && console.warn(...args),
};
const rollupOutput = {
  exports: "named",
  name: pascal(pkg.name),
  globals: {},
  sourcemap: true,
  banner,
};

const rollupTask = (output = {}, input = {}) => {
  return async () => {
    const bundle = await rollup.rollup({...rollupInput, ...input});
    return bundle.write({...rollupOutput, ...output});
  };
};



task("clean:typescript", (cb: CB) => require("rimraf")(dirs.entryJs, cb));
task("clean:bundle", (cb: CB) => require("rimraf")(dirs.output, cb));
task("clean", series(
  task("clean:typescript"),
  task("clean:bundle")
));


task("build:typescript", shell.task("ttsc -p ./"));
task("build:iife", rollupTask({ format: "iife", file: files.outputIife }));
task("build:min",  rollupTask({ format: "iife", file: files.outputMin }, { plugins: [sourcemaps(), babel({ presets: ["@babel/env"] }), uglify()] }));
task("build", series(
  task("build:typescript"),
  task("build:iife"),
  task("build:min"),
  task("clean:typescript")
));


task("default", task("build"));
