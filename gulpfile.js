var gulp = require('gulp'),
	concat = require('gulp-concat'),
	del = require('del'),
	uglify = require('gulp-uglify');

gulp.task('default', ['make']);

gulp.task('make', [ 'js' ]);

gulp.task('clean', function () {
	del([
		'*.min.js'
	]);
});

gulp.task('js', function () {
	return gulp.src([
			'js/zepto-deferred.js',
			'howler.js/howler.js',
			'js/SonicUtils.js',
			'js/**'
		])
		.pipe(uglify({
			preserveComments: 'license',
		}))
		.pipe(concat('sonicshuffle.min.js'))
		.pipe(gulp.dest('./'));

});

gulp.task('watch', function () {
	gulp.watch([
		'*.js',
	], [ 'js' ]);
});