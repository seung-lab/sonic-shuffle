/* SFX.js
 *
 * Controls for the sound effects system in EyeWire. See Music.js for background music.
 * 
 * Lazy loads almost everything.
 *
 * Author: William Silversmith
 * Date: June - October 2015
 * Affilliation: WiredDifferently, Inc.
 */

var SFX = SFX || {};

(function (undefined) {
	"use strict";

	var _prefs;

	var _volume = 1;
	var _mute = false;

	var lazyHowlFactory = SonicUtils.thunkify(howlFactory),
		lazyRandomSFXFactory = SonicUtils.thunkify(randomSFXFactory),
		lazyChimeSFXFactory = SonicUtils.thunkify(chimeSFXFactory);

	var _library = {
		immediate_load_standard_example: howlFactory('url/to/sfx/sound.ogg'),
		lazy_load_standard_example: lazyHowlFactory('url/to/sfx/lazy-sound.ogg'),

		immediately_loading_random_sfx: randomSFXFactory('url/to/random/sfx/file{i}.ogg', 3),
		lazy_loading_random_sfx: lazyRandomSFXFactory('url/to/random/sfx2/file{i}.ogg', 3),
		
		immediately_loading_chime_sfx: chimeSFXFactory('url/to/chime/chime{i}.ogg'),
		lazy_loading_chime_sfx: lazyChimeSFXFactory('url/to/chime2/chime2{i}.ogg'),
	};

	// Per song relative frequencies of chime notes
	// to make it feel like you're playing along to the
	// mood of the current song. Note: Track numbers begin at 1
	var _frequency_tiers = {
		alternatepaths: [ 
			{ relfreq: 1, fx: [ 3, 6, 1 ] },
			{ relfreq: 0.85, fx: [ 5, 2 ] }, 
			{ relfreq: 0.7, fx: [ 4 ] }
		],
		theneuralstream: [
			{ relfreq: 1, fx: [ 3, 6, 1 ] },
			{ relfreq: 0.85, fx: [ 5, 2 ] }, 
			{ relfreq: 0.7, fx: [ 4 ] }
		],
		ideas: [
			{ relfreq: 1, fx: [ 5 ] },
			{ relfreq: 0.85, fx: [ 3 ] }, 
			{ relfreq: 0.7, fx: [ 4, 2 ] },
			{ relfreq: 0.6, fx: [ 1, 6 ] }
		],
		labwork: [
			{ relfreq: 1, fx: [ 5 ] },
			{ relfreq: 0.85, fx: [ 3 ] }, 
			{ relfreq: 0.7, fx: [ 2 ] },
			{ relfreq: 0.6, fx: [ 4 ] },
			{ relfreq: 0.5, fx: [ 1, 6 ] }	
		],
		makingconnections: [
			{ relfreq: 1, fx: [ 2 ] },
			{ relfreq: 3, fx: [ 1, 3, 4, 5, 6 ] }, 
		],
	};

	var _rotates = [];

	SFX.cubeRotate = function () {
		if (_mute) { return; }

		var clip = _library.cube_rotate.next().clone();

		_rotates.push(clip);

		clip
			.volume(0)
			.play()
			.pos(clip.duration() / 1000 * Math.random() / 2)
			.volume(_volume);

		return clip.one('stop', function () {
			// using _rotates.filter introduces a
			// problem if clip is added multiple times
			var index = _rotates.indexOf(clip);

			if (index === -1) {
				return;
			}

			_rotates.splice(index, 1);
		});
	};

	SFX.cubeUnrotate = function () {
		if (_rotates.length === 0) { return; }

		while (_rotates.length) {
			var clip = _rotates.shift();
			clip.fade({
				from: _volume, 
				to: 0, 
				msec: 500,
			})
			.always(function () {
				clip.stop();
			});
		}
	};

	SFX.play = function (piece, delay) {
		if (_mute) { return; }

		var effect = piece;
		if (typeof(piece) === 'string') {
			effect = _library[piece];
			if (!effect) {
				console.log(piece + " was not listed in the library.");
				return null;
			}
			else if (typeof(effect) === 'function') { // for lazy loading
				effect = effect();
				_library[piece] = effect;
			}
		}

		delay = delay || 0;

		var fn = function () {
			effect.volume(_volume);
			return effect.play();
		};

		if (delay) {
			return setTimeout(fn, delay);
		}
		else {
			return fn();
		}
	};

	// Delazify if lazified, which will provoke a network request
	SFX.load = function (piece) {
		if (typeof _library[piece] === 'function') {
			_library[piece] = _library[piece]();
			var sfx = _library[piece];
			sfx.volume(_volume);
			if (_mute) {
				sfx.mute();
			}
		}
		
		return _library[piece];
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
	SFX.perceptualVolume = function (vol) {
		if (vol === undefined) {
			return Music.Mixins.gainToPerceptualVolume(SFX.volume());
		}

		vol = vol || 0;

		if (vol <= 0.03) {
			vol = 0;
		}
		else {
			vol = Music.Mixins.gainToPerceptualVolume(vol);
		}

		return SFX.volume(vol);
	};

	SFX.volume = function (vol) {
		if (vol !== undefined) {
			_volume = SonicUtils.clamp(vol, 0, 1);
		}

		Object.keys(_library).forEach(function (piece) {
			if (_library[piece] && typeof(_library[piece]) !== 'function') {
				_library[piece].volume(_volume);
			}
		});

		return _volume;
	};

	SFX.mute = function (yes) {
		if (yes === undefined || yes === null) {
			yes = true;
		}

		yes = !!yes;

		_mute = yes;

		Object.keys(_library).forEach(function (piece) {
			if (!_library[piece] || typeof(_library[piece]) === 'function') { return; }
			
			if (yes) {
				_library[piece].mute();
			}
			else {
				_library[piece].unmute();
			}
		});
	};

	SFX.unmute = function () {
		return SFX.mute(false);
	};

	// necessary to avoid order of loading dependencies
	SFX.initialize = function (prefs) {
		_prefs = prefs;

		SFX.perceptualVolume(
			_prefs.get('sfx_volume')
		);

		if (_prefs.get('mute')) {
			SFX.mute();
		}

		window.SFX = SFX;
	};

	function howlFactory (url) {
		var ogg = url.replace(/wav$/, 'ogg');
		var mp3 = ogg.replace(/ogg$/, 'mp3');

		var howl = new Howl({
			urls: [ ogg, mp3 ],
			autoplay: false,
			loop: false,
			volume: _volume,
		});

		return howl.on('loaderror', function () {
			console.error(url + " failed to load.");
		});
	}

	/* randomSFX
	 *
	 * Generate an object that implements a similar interface to a howler 
	 * object in terms of "play", "pause", "stop", "volume", but actually is a set of
	 * sub-objects that may be selected to play at random.
	 *
	 * Required:
	 *   [0] urls: array of references to playable objects
	 *   
	 * Optional:
	 *   [1] repeat_multiplier: Can provide a frequency multipler to decrease or increase the 
	 *		likelihood that an SFX will be played again right after it plays.
	 *
	 * Return: obj implementing play, pause, stop, volume, mute, unmute
	 */
	function randomSFX (urls, repeat_multiplier) {
		var obj = new function () {};

		obj.repeat_multiplier = SonicUtils.nvl(repeat_multiplier, 1);

		obj.tracks = urls.map(function (url) {
			return howlFactory(url);
		});

		obj.play = function () {
			var effect = this.next();
			this.playing = effect;
			return effect.play();
		};

		obj.next = function () {
			var freqs = this.tracks.map(function (x) { return 1 });
			var repeat_idx = this.tracks.indexOf(this.playing);

			if (repeat_idx !== -1) {
				freqs[repeat_idx] *= this.repeat_multiplier;
			}

			var next_index = SonicUtils.biased_random_index(freqs);
			return this.tracks[next_index];
		};

		obj.pause = function () {
			if (!this.playing) { return; }
			this.playing.pause();
		};

		obj.stop = function () {
			if (!this.playing) { return; }
			this.playing.stop();
		};

		obj.volume = function () {
			var args = Array.prototype.slice.call(arguments);
			this.tracks.forEach(function (effect) {
				effect.volume.apply(effect, args);
			});

			return _volume;
		};

		obj.mute = function () {
			this.tracks.forEach(function (effect) {
				effect.mute();
			});
		};

		obj.unmute = function () {
			this.tracks.forEach(function (effect) {
				effect.unmute();
			});
		};

		return obj;
	}

	function randomSFXFactory (base_url, N) {
		N = N || 6;

		var urls = [];
		for (var i = 1; i <= N; i++) {
			urls.push(
				base_url.replace('{i}', i)
			);
		}

		return randomSFX(urls, 0.1);
	}

	function chimeSFXFactory (base_url) {
		var sfx = randomSFXFactory(base_url);

		var super_next = sfx.next;

		sfx.next = function () {
			var mxinfo = Music.whatsPlaying();

			if (!mxinfo.piece) {
				return super_next.call(sfx);
			}

			var freqs = _frequency_tiers[mxinfo.piece];

			if (!freqs) {
				return super_next.call(sfx);
			}

			var total = SonicUtils.sum(
				freqs.map(function (x) { return x.relfreq })
			);

			var track_weights = new Array(sfx.tracks.length);

			freqs.forEach(function (tier) {
				tier.fx.forEach(function (track_number) {
					track_weights[track_number - 1] = tier.relfreq / total / tier.fx.length;
				});
			});

			var repeat_idx = sfx.tracks.indexOf(sfx.playing);

			if (repeat_idx !== -1) {
				track_weights[repeat_idx] *= sfx.repeat_multiplier;
			}

			var next_index = SonicUtils.biased_random_index(track_weights);
			return sfx.tracks[next_index];
		};

		return sfx;
	}

})();