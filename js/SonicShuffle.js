/* SonicShuffle
 *
 * A music system that uses modular components to extend the 
 * length of a piece.
 *
 * Designed by Alex Norton and John Smith
 * Composition by John Smith
 * Implemented by William Silversmith
 *
 * WiredDifferently, Inc., 2015
 *
 * Definition of Terms:
 *
 *	Section: An individual lettered piece of music that can be played in isolation 
 *		(an atomic unit of a Sonic Shuffle); Eg, A1
 *	Section Set: The set of sections that slot into a position in a cycle 
 *		(designated A, B, C, etc); eg, A1A2A3 = the A set
 *	Cycle: An ordered sequence of one section drawn from each section set, aka A1B1C1
 *	Full Cycle: A set of cycles played in sequence where each cycle chooses 
 *		its sections without replacement from their respective section sets.
 *	Power Full Cycle: The set of all possible cycles
 *	Piece: Roughly equivalent to a Power Full Cycle
 *
 *  Dependencies:
 *     - custom howler.js v1.1.28 (heavily modified)
 *     - jQuery-like deferred objects (for fading deferred objects)
 *     - SonicUtils.js
 */

/* SonicShuffle
 *
 * Object representing a piece of music
 *
 * Required:
 *	 sections: [
 *	 	[ A1, A2, A3, ... ], // Section A, A1 = filename etc
 *	 	[ B1, B2, B3, ... ], // Section B
 *	     ...
 *	 ],
 *
 * Optional:
 *   title: string
 *   end: 'section', 'cycle', 'fullcycle' (default), or 'loop'
 *   intro: filepath, if specified introduces the shuffle with this piece
 *   volume: float in [0, 1], defaults to 1
 *   overlaps: [
 *   	[ 13000, 32000, 19400 ], // Fire overlap events at this many msec for A1, A2, A3 respectively
 *      ... 
 *   ]
 *   finale: msec, throw the "finale" event this many msec before the final section terminates
 *
 * Return: obj
 */
(function ($, undefined) {
	"use strict";

	Music.SonicShuffle = function (args) {
		args = args || {};

		var _this = this;

		this.gain = SonicUtils.clamp(SonicUtils.nvl(args.volume, 1), 0, 1);

		this.title = args.title || null;

		this.intro = howlFactory(args.intro, this.gain, args.overlap_intro);
		this.sections = initalizeSections(args.sections, this.gain, args.overlaps);
		this.section_states = resetSectionsPlayed(this.sections);
		this.muted = false;

		this.has_overlaps = !!args.overlaps || !!args.intro_overlap;
		this.finale = args.finale || null;

		this.section_set = null; // section set index
		this.section = null; // section index

		this.state = 'stopped';

		this._fading = {}; // contains timers

		this.callbacks = {};

		_this.end_stop = SonicUtils.nvl(args.end_stop, true);
		_this.end = args.end !== undefined 
			? args.end
			: 'fullcycle';

		var mapping = {
			section: 'section-end',
			cycle: 'cycle-end',
			fullcycle: 'fullcycle',
		};

		var evt = mapping[_this.end];
		if (evt && _this.end_stop) {
			this.on(evt, function () { 
				_this.trigger('end');
				_this.stop();
			});
		}

		return this;
	};

	Music.SonicShuffle.prototype.play = function () {
		var _this = this;

		if (this.state === 'playing') {
			return this;
		}

		if (this.sections.length === 0) {
			console.log("There are no sections included in this sonic shuffle. Unable to initiate play.");
			return this;
		}

		if (this.state == 'paused') {
			this.nowPlaying().play();
			this.state = 'playing';
			return this;
		}

		function next () {
			var finished = _this.isLastSection();

			// For first play or transition from intro.
			if (_this.section_set === null || _this.section_set === -1) {
				_this.section_set = _this.sections.length - 1; // set initally to T to make S the successor state
			}

			var section = moveToSucessorState.call(_this); // emits fullcycle evt

			processFinaleEvent.call(_this, section);

			// Must occur after "moveToSuccessorState" in order to process
			// events and cleanup
			if (finished && _this.end_stop) {
				return;
			}

			if (!section) {
				return;
			}

			var sectionset = _this.section_set; // must freeze state to avoid race condition

			section.ion('end', function () {
				_this.trigger('section-end');

				if (sectionset === _this.sections.length - 1) {
					_this.trigger('cycle-end');
				}

				if (!_this.has_overlaps) { // normal operation
					next();
				}
			});

			if (_this.has_overlaps) {
				section.ion('overlap', function () {
					next();
				});
			}

			// these if statements are in case the tiggers 
			// end up pausing or stopping the music
			if (_this.state === 'playing') {
				if (_this.section_set === 0) {
					_this.trigger('cycle-begin');
				}

				_this.trigger('section-begin', _this.section_set, _this.section);

				if (_this.state === 'playing') {
					var vol = _this.muted ? 0 : _this.volume();
					section.volume(vol).play();
				}
			}
		}

		var playintro = this.state === 'stopped' && this.intro;

		this.state = 'playing';
		this.trigger('play');

		if (playintro) {
			this.section_set = -1; // -1 isn't a valid succession state, so it's used to designate the intro
			this.section = 0;

			var terminalevt = _this.has_overlaps 
				? 'overlap'
				: 'end';

			this.intro.ion(terminalevt, function () {
				next();
			});

			this.intro.play();
			this.trigger('section-begin', _this.section_set, _this.section);
		}
		else {
			next();
		}
		
		return this;
	};

	// The finale event is an early warning signal so that
	// things like fade outs can be implmented before the track
	// completely dies.
	function processFinaleEvent (section) {
		var _this = this; 

		if (_this.finale === null
			|| !_this.isLastSection()) {

			return;
		}

		var msec = Math.max(section.duration() - _this.finale, 0);

		section
			.timer(msec, 'finale')
			.ion('finale', function () {
				section.off('finale');
				_this.trigger('finale');
			});
	};

	// Is this the last section that's going to play before the end?
	Music.SonicShuffle.prototype.isLastSection = function () {
		if (this.end === 'section') {
			return true;
		}
		else if (this.end === 'cycle') {
			return this.section_set === this.sections.length - 1;
		}
		else if (this.end === 'fullcycle') {
			// full cycle
			return (this.section_set === this.sections.length - 1
				&& !cycleExists(this.section_states));
		}

		return false;
	};

	/* moveToSucessorState
	 *
	 * The sonic shuffle can be viewed as a
	 * cyclic finite automaton that is constructed in
	 * layers (Section Sets) that contain edges
	 * from each node in the layer to all nodes 
	 * in the next layer. As nodes are visited,
	 * their incoming edges are pruned. 
	 *
	 * When the cycle is broken via the pruning process,
	 * the graph is reinstated upon visiting the terminal layer T
	 * or the start layer S.
	 *
	 * Entering S generates a "cycle-start" event, while leaving T
	 * generates a "cycle-end" event.
	 *
	 * The visitation graph (equivalent ot the edge description above) is stored 
	 * in this.section_states as boolean values.
	 * 
	 */
	function moveToSucessorState () {
		this.section_set = (this.section_set + 1) % this.sections.length;

		if (this.section_set === 0 
			&& !cycleExists(this.section_states)) {
			
			this.trigger('fullcycle');
			this.section_states = resetSectionsPlayed(this.sections);
		}

		// in case fullcycle events call stop or pause
		if (this.state !== 'playing') {
			return null;
		}

		// map [ true, false, true, true, false, true ]
		// to  [ 0, 2, 3, 5 ]

		var counter = 0;
		var possible = this.section_states[this.section_set].map(function (bool) {
			counter++;
			return bool 
				? counter - 1
				: null;
		}).filter(function (x) { return x !== null });

		this.section = SonicUtils.random_choice(possible);

		this.section_states[this.section_set][this.section] = false;

		return this.nowPlaying();
	}

	function cycleExists (visitgraph) {
		function or (x, y) { return x || y };

		return visitgraph.reduce(function (a, b) {
			return a && b.reduce(or);
		}, true);
	}

	Music.SonicShuffle.prototype.pause = function () {
		if (!this.nowPlaying() || this.state !== 'playing') {
			return this;
		}

		this.state = 'paused';
		this.nowPlaying().pause();	

		this.trigger('pause');

		return this;
	};

	Music.SonicShuffle.prototype.stop = function () {
		this.state = 'stopped';
		
		this.forEachSection(function (section) {
			section.stop();
		});

		this.section_set = null;
		this.section = null;

		this.section_states = resetSectionsPlayed(this.sections);

		this.trigger('stop');

		return this;
	};

	Music.SonicShuffle.prototype.mute = function () {
		this.muted = true;

		this.forEachSection(function (section) {
			section.mute();
		});

		this.trigger('mute', true);

		return this;
	};

	Music.SonicShuffle.prototype.unmute = function () {
		this.muted = false;

		this.forEachSection(function (section) {
			section.unmute();
		});

		this.volume(this.volume());

		this.trigger('mute', false);

		return this;
	};

	/* fade
	 *
	 * Smoothly interpolate the volume of the piece from one position
	 * to the other.
	 *
	 * There are some tricky situations that pop up since various UI 
	 * events of differing importance will compete for volume control. 
	 *
	 * Additionally, because of the nature of the Sonic Shuffle, some 
	 * subsections may be cross fading independently at the same time that
	 * the piece as a whole is attempting to fade. This competition can result
	 * in static as gain values ping pong between the two masters 
	 * if not carefully managed.
	 *
	 * Towards these ends, this fading feature attempts to balance several concerns.
	 * 
	 * By default, the if you call a fade while another is in progress, it will cancel
	 * and initiate a fade in the new direction. However, the return type is a jQuery
	 * deferred so you can use .fail or .always to ensure your post-fade callback is 
	 * executed (though you might only want it to execute on success, this is your choice).
	 *
	 * To handle competing priorities, a higher priority fade (priority argument) essentially 
	 * acquires a lock on the volume control. Only an equal or higher priorty fade can override it.
	 * This is important for, e.g. the mute button.
	 *
	 * While I think the provided easing function is awesome (cosine decay), you might want to 
	 * provide your own (e.g. sinusoidal, exponential, etc). The easing function makes this 
	 * possible. 
	 *
	 * Required:
	 *   to: >= 0.0 (typically 0.0 to 1.0): Final volume state
	 *   msec: Duration of the fade in msec.
	 *
	 * Optional:
	 *   from: >= 0.0 (typically 0.0 to 1.0), initial volume level (default: current)
	 *   priority: Number, acquires mutex on volume control against lower priority levels
	 *   easing: fn(t), t in 0..1, ret 0..1, map of % animation complete to volume level
	 *   normalizer: If the shuffle is a sub-object of something else that can fade,
	 *        you can provide a value to normalize the output by.
	 *
	 *        e.g. Your sound system as a whole is fading out you want to fade
	 *          from 50% to 100% of your shuffle's volume relative to the master volume.
	 *			You'll possibly need to exclude this piece from the other fading mechanism
	 *			using the .isFading method.
	 *        
	 *          music.fade({
	 * 				from: 0.5,
	 * 				to: 1.0,
	 *				msec: 2500,
	 *				normalizer: function () { return SFX.volume() }, // shuffle.vol = shuffle.vol * SFX.vol
	 *          })
	 *
	 * Return: jQuery deferred object, resolve on complete, reject if aborted
	 */
	Music.SonicShuffle.prototype.fade = function (args) {
		args = args || {};

		var _this = this;

		var from = SonicUtils.nvl(args.from, _this.volume()),
			to = SonicUtils.assertDefined(args.to),
			msec = SonicUtils.assertDefined(args.msec),

			priority = args.priority || 0,
			normalizer = args.normalizer || function () { return 1 },
			
			easing = args.easing || function (t) {
				var gain = Music.Mixins.gainToPerceptualVolume(gain);
				gain = 1 - Math.cos(Math.PI * t / 2); // try graphing this on [0, 1]
				return SonicUtils.clamp(gain, 0, 1);
			};

		if (_this._fading.promise) {
			if (priority < _this._fading.priority) {
				return $.Deferred().reject();
			}
			else {
				_this._fading.promise.reject();
			}
		}

		_this._fading.priority = priority;

		var mutevol = function (v) {
			return _this.muted ? 0 : v;
		};

		var promise = $.Deferred()
			.done(function () {
				_this.volume(mutevol(to * normalizer()));
			})
			.always(function () {
				_this._fading = {};
			});

		// NOTE: Useful for efficiency, but maybe not so good
		// if someone uses a custom easing function for
		// osscillations.
		if (Math.abs(to - this.gain) < 0.00001 || msec === 0) {
			_this.volume(mutevol(to * normalizer()));
			return promise.resolve();
		}

		_this.volume(from * normalizer());

		var start = window.performance.now();
		var delta = to - from;

		var stepper = setInterval(function () {
			var now = window.performance.now();
			var t = (now - start) / msec;

			if (t >= 1) {
				promise.resolve();
				return;
			}

			var vol = from + delta * easing(t);
			vol *= normalizer();

			_this.volume(mutevol(vol));
		}, 15); // max guaranteed resolution

		_this._fading.promise = promise;

		return promise.always(function () {
			clearInterval(stepper);
		});
	};

	Music.SonicShuffle.prototype.isFading = function () {
		return !!this._fading.promise;
	};

	Music.SonicShuffle.prototype.cancelFade = function (priority) {
		priority = priority || 0;

		if (this._fading.promise
			&& this._fading.priority <= priority) {

			this._fading.promise.reject();
		}

		return this;
	};

	// Note: If the volume is changed during a fade, inconsistent behavior
	// will result. Currently, the volume will spike towards the set value for
	// about 10msec and then progress towards the fade and then jump to the faded
	// value.
	//
	// Possible solution:
	// Fading feedback loop: Target volume is remembered and fade tracks to it
	// 		over time. Target volume can be updated by the volume command. 
	//      The ramping rate can be recalculated as necessary to meet the time  
	//      target. This sounds like a PID controller, but we'd probably only need the
	//      P part (hopefully). The error term would be TARGET - (CURRENT + STEP * TIME_REMAINING) = 0
	//		with STEP being the variable manipulated. 
	//
	Music.SonicShuffle.prototype.volume = function (vol) {
		if (vol === undefined || vol === null) {
			return this.gain;
		}

		vol = parseFloat(vol);
		vol = SonicUtils.clamp(vol, 0, 1);

		this.gain = vol;

		this.trigger('volume', vol);

		if (this.muted) {
			return this.mute();
		}

		this.forEachSection(function (section) {
			// sections being faded in are given a special treatment.
			// See the bottom of Music.SonicShuffle.play.
			if (section.isFading()) { return; } 
			
			section.volume(vol);
		});

		return this;
	};
	
	Music.SonicShuffle.prototype.nowPlaying = function () {
		if (this.section_set === null || this.section === null) {
			return null;
		}

		if (this.section_set === -1) {
			return this.intro;
		}

		return this.sections[this.section_set][this.section];
	};

	Music.SonicShuffle.prototype.forEachSection = function (fn) {
		fn = fn || function () {};
		this.sections = this.sections || [];

		if (this.intro) {
			fn(this.intro, -1, 0);
		}

		for (var sectionset = 0; sectionset < this.sections.length; sectionset++) {
			for (var section = 0; section < this.sections[sectionset].length; section++) {
				fn(this.sections[sectionset][section], sectionset, section);
			}
		};

		return this;
	};

	/* on
	 *
	 * Attach callbacks to specified actions.
	 *
	 * Required:
	 *	[0] action: 'show', 'dismiss', etc. The action we want to attach a callback to.
	 *  [1] fn
	 *
	 * Returns: this
	 */
	Music.SonicShuffle.prototype.on = function (action, fn) {
		this.callbacks = this.callbacks || {};
		this.callbacks[action] = this.callbacks[action] || [];

		this.callbacks[action].push(fn);

		return this;
	};

	// Idempotent on.
	Music.SonicShuffle.prototype.ion = function (action, fn) {
      return this.off(action).on(action, fn);
    };

    // remove handler after firing. Like jQuery
    Music.SonicShuffle.prototype.one = function (action, fn) {
      var _this = this;

      var wrapperfn = function () {
        fn.apply(_this, arguments);
        _this.off(action, fn);
      };

      return _this.on(action, wrapperfn);
    };

	/* off
	 *
	 * Removes callbacks from a specified action.
	 * If fn is specified, it will remove that handler.
	 * If fn is not specifed, all callbacks for that action
	 * will be removed.
	 *
	 * Required:
	 *	 [0] action
	 *
	 * Optional:
	 *  [1] fn
	 *
	 * Returns: this
	 */
	 Music.SonicShuffle.prototype.off = function (action, fn) {
		this.callbacks = this.callbacks || {};

		if (!this.callbacks[action]) {
			return this;
		}

		if (fn) {
			this.callbacks[action] = $.grep(this.callbacks[action], function (elem, index) {
				return elem !== fn;
			});
		}
		else {
			this.callbacks[action] = [];
		}

		return this;
	};

	/* trigger
	 *
	 * Execute the callbacks for a particular action.
	 *
	 * Required:
	 *   [0] action: e.g. 'show', 'dismiss'
	 *
	 * Optional:
	 *   [1..n]: Optional positional arguments to feed to cbs
	 *
	 * Return: this
	 */
	Music.SonicShuffle.prototype.trigger = function (action) {
	  	var cbs = this.callbacks[action] || [];

	  	var args = Array.prototype.slice.call(arguments);
	  	args.shift(); // remove action

		for (var i = 0; i < cbs.length; i++) {
			cbs[i].apply(this, args);
		}

		return this;
	};

	function initalizeSections (urls, volume, overlaps) {
		urls = urls || [];

		var howls = urls.map(function (sectionset) {
			return sectionset.map(function (url) {
				return howlFactory(url, volume);
			});
		});

		if (!overlaps) {
			return howls;
		}

		var msec;
		for (var i = 0; i < howls.length; i++) {
			for (var j = 0; j < howls[i].length; j++) {
				overlaps[i] = overlaps[i] || [];
				overlaps[i][j] = overlaps[i][j] || 0;

				msec = overlaps[i][j];
				howls[i][j].timer(msec, 'overlap');
			}
		}

		return howls;
	}

	function howlFactory (url, volume, overlap) {
		if (!url) {
			return null;
		}

		volume = SonicUtils.clamp(SonicUtils.nvl(volume, 1), 0, 1);

		var ogg = url.replace(/wav$/, 'ogg');
		var mp3 = ogg.replace(/ogg$/, 'mp3');

		var howl = new Howl({
			urls: [ ogg, mp3 ], // not using wavs, too big
			autoplay: false,
			loop: false,
			volume: volume,
		});

		if (overlap !== undefined) {
			howl.timer(overlap, 'overlap');
		}

		howl.on('loaderror', function () {
			console.error(url + " failed to load.");
		});

		return howl;
	}

	function resetSectionsPlayed (sections) {
		sections = sections || [];

		return sections.map(function (sectionset) {
			return sectionset.map(function (section) {
				return true;
			});
		});
	};

	// polyfill for high res time.
	// note that this cannot be done like x = window.performance.now  || Date.now; 
	// performance.now is a native function and that will cause an illegal invocation.
	// performance.now is also guaranteed to be monotonic which is crucial for our effects.
	window.performance.now = window.performance.now  || Date.now; 

})(jQuery || Zepto);







