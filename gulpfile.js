const Gulp   = require('gulp');
const ESLint = require('gulp-eslint');
const Mocha  = require('gulp-mocha');
const GUtil  = require('gulp-util');

Gulp.task('default', function(done) {
    GUtil.log(
        '\n\n',
        GUtil.colors.bold.red('Available Commands: \n'),
        '  gulp', GUtil.colors.green('test           '),
        GUtil.colors.grey('  - Run test suites.\n'),
        '  gulp', GUtil.colors.green('eslint         '),
        GUtil.colors.grey('  - Run Linting.\n'),
        '\n'
    );
    done();
});

Gulp.task('eslint-fix', function () {
    return Gulp.src([
        './bot.js',
        './gulpfile.js',
        './plugins/*.js'
    ])
        // Covering files
        .pipe(ESLint({ fix: true }))
        // Force `require` to return covered files
        .pipe(ESLint.format())
        .pipe( Gulp.dest(file => file.base) );
});

Gulp.task('eslint', function () {
    return Gulp.src([
        './bot.js',
        './discord.js',
        './gulpfile.js',
        './plugins/*.js'
    ])
        // Covering files
        .pipe(ESLint({ }))
        // Force `require` to return covered files
        .pipe(ESLint.format());
});

