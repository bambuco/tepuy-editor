const gulp = require("gulp");
const eslint = require("gulp-eslint");
const rename = require("gulp-rename");
const concat = require("gulp-concat");
const uglify = require("gulp-uglify");
const sass = require('gulp-sass');
const concatcss = require('gulp-concat-css');
const postcss = require("gulp-postcss");
const file = require('gulp-file');
const path = require('path');
const inject = require('gulp-inject');
const sourcemaps = require("gulp-sourcemaps");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const browserSync = require('browser-sync').create();
const reload      = browserSync.reload;
const { rollup }  = require('rollup');
const { minify } = require('html-minifier');
const babel = require('rollup-plugin-babel');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const multiEntry = require("rollup-plugin-multi-entry");
const i18nScanner = require('i18next-scanner');

const destFolder = "./dist";

const vendorjs = [
    'node_modules/jquery/dist/jquery.min.js',
    'node_modules/jquery-ui-dist/jquery-ui.min.js',
    'node_modules/jsviews/jsviews.min.js',
    'vendor/js/jsviews-jqueryui-widgets.min.js',
    './fakeApi.js'
];

const vendorcss = [
    'node_modules/jquery-ui-dist/jquery-ui.min.css',
    'node_modules/jquery-ui-dist/jquery-ui.theme.min.css',
    //'node_modules/@fortawesome/fontawesome-free/css/solid.min.css',
    './vendor/css/*.css'
];

function joinVendorCss() {
    return gulp.src(vendorcss)
        .pipe(concatcss("vendor.min.css"))
        .pipe(gulp.dest(destFolder))
}

function copyVendorAssets() {
    return gulp.src(['node_modules/jquery-ui-dist/images/*'])
        .pipe(gulp.dest(destFolder + '/images'));
}
function copyIcons() {
    return gulp.src('node_modules/@fortawesome/fontawesome-free/webfonts/*')
        .pipe(gulp.dest(destFolder+'/webfonts/'));
}

//Required to be able to scan i18next keys on text/x-template files
function customTransform(file, enc, done) {
    if (/\.(?:html|htm)/.test(path.extname(file.path))) {
        var content = file.contents.toString('utf-8');
        var re = /^<script.*type="text\/(?:x-template|x-jsrender)".*>$/im;
        var match;
        while(match = re.exec(content)) {
            content = content.replace(re, '').replace(/^<\/script>$/im, '');
        }

        this.parser.parseAttrFromString(content, {
            transformOptions: { filepath: file.path }
        });
    }
    done();
}

function translations() {
    return gulp.src(["./src/**/*.{js,html}"]) //'./src/**.{js,html}'
        .pipe(i18nScanner({
            lngs: ['es', 'en'], // supported languages
            trans: false,
            defaultLng: 'es',
            defaultNs: 'core',
            ns: ['core'],
            //removeUnusedKeys: false,
            resource: {
                loadPath: 'i18n/{{lng}}/{{ns}}.json',
                savePath: 'i18n/{{lng}}/{{ns}}.json'
            }
        }, customTransform))
        .pipe(gulp.dest('./'))
        .pipe(gulp.dest(destFolder));
}

gulp.task("vendorjs", function() {
    return gulp.src(vendorjs)
        .pipe(concat("vendor.min.js"))
        .pipe(gulp.dest(destFolder))
});

gulp.task("vendorcss", gulp.parallel(joinVendorCss, copyVendorAssets, copyIcons));

gulp.task("js", function () {
    return rollup({
        input: ['./src/js/app.js', './src/plugins/**/component.js'], // entry point //./src/js/index.js //./src/js/plugins/**/component.js
        external: ['jquery'],
        plugins: [
            multiEntry(),
            resolve({
                mainFields: ['main', 'jsnext'],
                browser: true,
            }),
            commonjs(),
            eslint({
                exclude: [
                    'src/styles/**',
                    'src/scss/**'
                ]
            }),
            babel({
                exclude: 'node_modules/**'
            }),
            //(process.env.NODE_ENV === 'production' && uglify())
        ]
    })
    .then(bundle => {
        return bundle.generate({
            format: 'umd',
            name: 'tepuyEditor'
        })
    })
    .then(gen => {
        return file('tepuy-editor.js', gen.output[0].code, {src: true})
            .pipe(gulp.dest(destFolder))
            .pipe(browserSync.stream());
    });
});

gulp.task('sass', function() {
    return gulp.src(["./src/scss/*.scss", "./src/plugins/**/*.scss"])
        .pipe(sourcemaps.init())
        .pipe(sass({includePaths: ['scss']}))
        .on("error", sass.logError)
        .pipe(concatcss('tepuy-editor.css'))
        .pipe(postcss([autoprefixer()]))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest("./src/css"))
        .pipe(gulp.dest(destFolder))
        .pipe(browserSync.stream());
});

gulp.task('html', function () {
    return gulp.src('./index.html')
        .pipe(inject(gulp.src(['./src/plugins/**/*.html']), {
            starttag: '<!-- inject:template:{{ext}} -->',
            transform: (filePath, file) => {
                return minify(file.contents.toString('utf8'), { 
                    collapseWhitespace: true,
                    processScripts: ['text/html', 'text/x-template', 'text/x-jsrender']
                });
            }
        }))
        .pipe(gulp.dest(destFolder))
        .pipe(browserSync.stream());
});

gulp.task('compile', gulp.parallel('html', 'sass', 'vendorcss', 'vendorjs', 'js', translations));

// Static Server + watching scss/html files
gulp.task('serve', gulp.series('compile', function () {
    // Serve files from the root of this project
    browserSync.init({
        server: {
            baseDir: "./dist"
        }
    });

    gulp.watch(["./src/scss/*.scss", "./src/plugins/**/*.scss"], gulp.series('sass'));
    gulp.watch(["./src/js/*.js", "./src/plugins/**/*.js"], gulp.parallel('js', translations));
    gulp.watch(["./src/fakeApi.js"], gulp.series('vendorjs'));
    gulp.watch(["./index.html", "./src/plugins/**/*.html"], gulp.parallel('html', translations));
}));

gulp.task('build-js', gulp.series('js', function () {
    return gulp.src("./dist/tepuy-editor.js")
        .pipe(uglify())
        .pipe(rename('tepuy-editor.min.js'))
        .pipe(gulp.dest(destFolder));
}));

gulp.task('build-css', gulp.series('sass', function () {
    return gulp.src("./src/css/*.css")
        .pipe(concat("tepuy-editor.min.css"))
        .pipe(postcss([cssnano()]))
        .pipe(gulp.dest(destFolder))
}));

gulp.task("build", gulp.parallel('html', 'vendorjs', 'vendorcss', 'build-js', 'build-css', translations));

gulp.task("default", gulp.series("serve"));