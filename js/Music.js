/* Music.js
 *
 * Controls for the background music system in EyeWire. See SFX.js for sound effect controls.
 *
 * Lazy loads everything. Uses a system of promises to ensure music doesn't overlap.
 *
 * See SonicShuffle.js for more information on how most of the music plays.
 * 
 * Author: William Silversmith
 * Date: June - October 2015
 * Affilliation: WiredDifferently, Inc.
 */

var Music = Music || {};

(function ($, undefined) {
	"use strict";

	var _prefs;

	var _nowplaying = { piece: null, audio: null };
	var _volume = 1;
	var _state = 'stopped';

	var _theme = null;
	var _tracingthemefullcycles = 0;

	var _mute = false;

	var _xfademsec = {
		very_fast: 750,
		fast: 2500,
		slow: 14000,
	};

	var _xfadepriority = {
		low: -1,
		normal: 0,
		medium: 1,
		high: 2,
	};

	var _library;

	var lazyShuffleFactory = SonicUtils.thunkify(shuffleFactory),
		lazyHowlFactory = SonicUtils.thunkify(howlFactory);

	var _stopping_promise;

	Music.play = function (piece) {
		if (_nowplaying.piece === piece
			&& _state === 'playing') {

			return $.Deferred().resolve();
		}

		var music = Music.load(piece);
		var vol = _mute ? 0 : _volume;

		if (_stopping_promise) {
			_stopping_promise.reject();
		}

		_stopping_promise = $.Deferred(); // $.when explicitly won't allow external reject/resolves

		Music.stop().done(function () { 
			_stopping_promise.resolve();
		});

		if (music) {
			_stopping_promise.done(function () {
				_nowplaying = {
					piece: piece,
					audio: music,
				};

				Music.stopNonPlayingTracks();

				music
					.cancelFade(_xfadepriority.normal)
					.volume(vol)
					.play();
			});
			
			_state = 'playing';
		} 
		else {
			console.log(piece + " was not listed in the library.");
		}

		return _stopping_promise;
	};

	Music.load = function (piece) {
		if (typeof _library[piece] === 'function') {
			_library[piece] = _library[piece]();
			var music = _library[piece];
			music.volume(_volume);
			if (_mute) {
				music.mute();
			}
		}
		
		return _library[piece];
	};

	Music.exampleThemeSet = function () {
		Music.playThemeSet('example', [ 'single_file_example', 'sonic_shuffle_example' ]);
	};

	Music.playThemeSet = function (theme, pieces) {
		if (_theme === theme && _state === 'playing') { return; }

		_theme = theme;

		var plays = 0,
			switch_after = 2;

		ply(next(pieces, null));

		function next (pieces, last_pick) {
			var choices = pieces.filter(function (x) { return x !== last_pick; });
			return SonicUtils.random_choice(choices) || pieces[0]; // or condition takes care of pieces.length = 1
		}

		function ply (pick) {
			function finalefn () {
				var _this = this; 

				if (plays < switch_after - 1) {
					return;
				}

				_this
					.off('fullcycle')
					.ion('finale', function () {
						var next_pick = next(pieces, pick);
						
						Music.load(next_pick);

						_this
							.off('finale')
							.fade({
								from: _mute ? 0 : _this.volume(),
								to: 0, 
								msec: _xfademsec.slow, 
							})
							.always(function () {
								plays = 0;
								_this.stop();

								// need to check in case the xfade ended as the 
								// cube was entered.
								if (_theme === theme) {
									ply(next_pick);
								}
							});
					});
			}

			Music.play(pick).done(function () {
				_nowplaying.audio.ion('fullcycle', function () {
					plays++;
					finalefn.call(this);				
				});

				finalefn.call(_nowplaying.audio); // only does anything if switch_after is 1 (for testing)
			});
		}
	};

	Music.stop = function (args) {
		args = args || {};

		var music = _nowplaying.audio;
		var except = args.except || [];

		var nowplaying_promise;

		if (music && except.indexOf(music) === -1) {
			var vol = _mute ? 0 : _volume;

			nowplaying_promise = music.fade({
				from: vol, 
				to: 0, 
				msec: _xfademsec.fast,
				priority: _xfadepriority.medium,
			})
			.always(function () {
				music.stop();
			});
		}

		var others_promise = Music.stopNonPlayingTracks(args);

		nowplaying_promise = nowplaying_promise || $.Deferred().resolve();

		_state = 'stopped';

		return $.when(nowplaying_promise, others_promise);
	};

	Music.stopNonPlayingTracks = function (args) {
		args = args || {};
		var except = args.except || [];

		var promises = [];

		forEachTrack(function (track) {
			if (track === _nowplaying.audio
				|| except.indexOf(track) !== -1
				|| track.state === 'stopped') { 

				return; 
			}

			var promise = track.fade({
				from: _mute ? 0 : track.volume(),
				to: 0, 
				msec: _xfademsec.fast, 
				priority: _xfadepriority.medium,
			})
			.always(function () {
				if (track === _nowplaying.audio) { return; }
				track.stop();
			});

			promises.push(promise);
		});

		return $.when.apply($, promises);
	};
	
	Music.pause = function () {
		if (_nowplaying.audio) {
			var music = _nowplaying.audio;

			music.fade({
				from: _mute ? 0 : music.volume(), 
				to: 0, 
				msec: _xfademsec.fast,
				priority: _xfadepriority.medium,
			})
			.always(function () {
				music.pause();
			});
		}

		_state = 'paused';
	};

	Music.mute = function (yes) {
		if (yes === undefined || yes === null) {
			yes = true;
		}

		yes = !!yes;

		_mute = yes;

		Object.keys(_library).forEach(function (piece) {
			var track = _library[piece];

			if (!track || typeof track === 'function') { return; }

			var to = yes ? 0 : _volume;

			if (!yes) {
				track.unmute();
			}

			track.fade({
				from: track.volume(), 
				to: to, 
				msec: _xfademsec.very_fast, 
				priority: _xfadepriority.high,
			})
			.always(function () {
				// use _mute instead of yes otherwise double clicks of mute
				// otherwise double clicks of mute can interfere as this will be called
				// after the unmute due to the canceling of the fade
				if (_mute) { 
					track.mute();
				}
			});
		});

		if (!_mute) {
			setTimeout(function () {
				_nowplaying.audio.volume(_volume);
			}, _xfademsec.very_fast + 1);
		}
	};

	Music.whatsPlaying = function () {
		if (_state === 'playing' || _state === 'paused') {
			return {
				title: _nowplaying.audio.title,
				piece: _nowplaying.piece,
			};
		}
		
		return {};
	};

	Music.unmute = function () {
		return Music.mute(false);
	};


	/* perceptualVolume
	 *
	 * Human auditory perception is roughtly logarithmic.
	 * Linear volume controls make it hard to achieve proper
	 * control of a logarithmic process.
	 *
	 * c.f. http://dr-lex.be/info-stuff/volumecontrols.html
	 *
	 * Required:
	 *   [0] vol: float clamped to 0.0 to 1.0
	 *
	 * Return: same as volume
	 */
	Music.perceptualVolume = function (vol) {
		if (vol === undefined) {
			return Music.Mixins.gainToPerceptualVolume(Music.volume());
		}

		vol = vol || 0;

		// determined by the position at which the slider eclipses the edge of the track
		if (vol <= 0.03) { 
			vol = 0;
		}
		else {
			vol = Music.Mixins.gainToPerceptualVolume(vol);
		}

		return Music.volume(vol);
	};

	Music.volume = function (vol) {
		if (vol === undefined) {
			return _volume;
		}

		_volume = SonicUtils.clamp(vol, 0, 1);

		Object.keys(_library).forEach(function (piece) {
			if (_library[piece] && typeof _library[piece] !== 'function') {
				_library[piece].volume(_volume);
			}
		});

		return _volume;
	};

	// necessary to avoid order of loading dependencies
	Music.initialize = function (prefs) {
		_library = initializeLibrary();
		
		_prefs = prefs;

		Music.perceptualVolume(
			_prefs.get('music_volume')
		);

		if (_prefs.get('mute')) {
			Music.mute();
		}

		window.Music = Music;
	};

	function forEachTrack (fn) {
		Object.keys(_library).forEach(function (piece) {
			if (typeof _library[piece] !== 'function') {
				fn(_library[piece]);
			}
		});
	}

	function initializeLibrary () {

		// These magic numbers are the respective lengths
		// of pieces provided by the composer John Smith (really his name). 
		// This is necessary because each section of music has a reverb tail that
		// will overlap with the next piece.
		//
		// - William Silversmith, Jun. 29, 2015

		var overlaptimings = {
			sonic_shuffle_example: {
				intro: 33103,
				rest: [
					[ 49655, 33103, 49655 ],
					[ 33103, 33621, 66207 ],
					[ 49655, 33103, 17069 ]
				],
			},
		};

		var lib = {
			single_file_example: lazyHowlFactory('Song Name #1', '/url/to/song.ogg'),
			sonic_shuffle_example: lazyShuffleFactory('Song Name #2', '/url/to/song/directory/', 3, 3, overlaptimings.sonic_shuffle_example),
		};

		return lib;
	}

	function shuffleFactory(title, baseurl, num_section_sets, num_sections, overlaptimings) {
		baseurl = baseurl.replace(/\/$/, '') + '/';
		overlaptimings = overlaptimings || { intro: null, rest: null };

		var sections = [];

		var offset_a = 'a'.charCodeAt(0);

		for (var i = 0; i < num_section_sets; i++) {
			var sset = [];
			for (var j = 1; j <= num_sections; j++) {
				var letter = String.fromCharCode(i + offset_a);

				sset.push(
					baseurl + letter + j + '.ogg'
				);
			}

			sections.push(sset);
		}

		var shuffle = new Music.SonicShuffle({
			title: title,
			intro: baseurl + 'intro.ogg',
			sections: sections,
			volume: _volume,
			overlap_intro: overlaptimings.intro,
			overlaps: overlaptimings.rest,
			end: 'cycle',
			end_stop: false,
			finale: _xfademsec.slow,
		});

		// NOTE: You can remove these debugging statements

		// var offset_A = 'A'.charCodeAt(0);

		// shuffle.on('play', function () {
		// 	console.info("Playing " + shuffle.title + " at gain " + shuffle.gain);
		// });

		// shuffle.on('stop', function () {
		// 	console.info("Stopping " + shuffle.title);
		// });

		// // this is for testing
		// shuffle.on('section-begin', function (i,j) {
		// 	if (i === -1) {
		// 		console.info("Playing Intro");
		// 	}
		// 	else {
		// 		console.info('Playing: ' + String.fromCharCode(i + offset_A) + (j+1) + " (" + i + ',' + j + ")");
		// 	}
		// });

		return shuffle;
	}

	function howlFactory (title, url) {
		// wav - IE
		var ogg = url.replace(/wav$/, 'ogg'); // Chrome, Firefox
		var mp3 = ogg.replace(/ogg$/, 'mp3'); // Safari 

		var howl = new Howl({
			title: title,
			urls: [ ogg, mp3 ], // not using wavs, too big
			autoplay: false,
			loop: false,
			volume: _volume,
		});

		return howl.on('loaderror', function () {
			console.error(url + " failed to load.");
		});
	}
})(jQuery || Zepto);