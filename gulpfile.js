var gulp = require('gulp');
var inlinesource = require('gulp-inline-source');
var htmlmin = require('gulp-htmlmin');
var ghPages = require('gulp-gh-pages');

gulp.task('build', function() {
  var options = {};
  options.inlinesource = {
    compress: true
  };

  var stream = gulp.src('app/index.html')
    .pipe(inlinesource({compress: true}))
    .pipe(htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      removeOptionalTags: true
    }))
    .pipe(gulp.dest('./dist'));
  
  return stream;
});

gulp.task('deploy', ['build'], function() {
  gulp.src('./dist/index.html')
  .pipe(ghPages())
});
