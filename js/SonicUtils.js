/*
 *	Utils.js
 *
 *	This is a grab bag of utility functions that would be useful
 *	througout the program that mostly manipulate data.
 *
 * Author: William Silversmith
 * Affiliation: Seung Lab, MIT 
 * Date: June-August 2013
 */

var SonicUtils = SonicUtils || {};

(function (undefined) {
	"use strict";

	/* round
	 * 
	 * Same as Math.round, but you can pick which decimal
	 * place to round to. Defaults to the same as Math.round.
	 *
	 * Required:
	 *   [0] x: Floating point
	 *   [1] precison: How many decimal places? Can be positive or negative int.
	 *
	 * Return: rounded float
	 */
	SonicUtils.round = function (x, precision) {
		precision = precision || 0;
		return Math.round(x * Math.pow(10, precision)) / Math.pow(10, precision);
	};
	
	/* nvl
	 *
	 * "Null value." Usually you should use
	 * x = x || y, however sometimes a valid
	 * value of x is 0 or false (especially in array indicies). 
	 *
	 * This function makes things into a neat one liner.
	 * nvl(x, y)
	 *
	 * Required:
	 *   [0] val
	 *   [1] ifnull 
	 *
	 * Return: val || ifnull (but accounting for false and 0)
	 */
	SonicUtils.nvl = function (val, ifnull) {
		return !(val === undefined || val === null)
			? val
			: ifnull;
	};

	/* findCallback
	 *
	 * Often functions are designed so that the final positional
	 * argument is the callback. The problem occurs when you can have
	 * multiple optional positional arguments.
	 *
	 * Pass "arguments" to this function and it'll find the callback
	 * for you.
	 *
	 * Required:
	 *   [0] args: literally the "arguments" special variable
	 *
	 * Return: fn or null
	 */
	 SonicUtils.findCallback = function (args) {
	 	var callback = null;

	 	for (var i = args.length - 1; i >= 0; i--) {
	 		if (typeof(args[i] === 'function')) {
	 			callback = args[i];
	 			break;
	 		}
	 	}

	 	return callback;
	 };

	/* thunkify
	 *
	 * Turns a function into a thunk generator.
	 *
	 * Required:
	 *   [0] fn
	 *
	 * Return: fn
	 */
	SonicUtils.thunkify = function (fn) {
		return function () {
			var args = Array.prototype.slice.call(arguments);
			
			return function () {
				return fn.apply(fn, args);
			};
		};
	};

	/* compose
	 *
	 * Compose N functions into a single function call.
	 *
	 * Required: 
	 *   [0-n] functions or arrays of functions
	 * 
	 * Returns: function
	 */
	SonicUtils.compose = function () {
		var fns = SonicUtils.flatten(arguments);

		return function () {
			for (var i = 0; i < fns.length; i++) {
				fns[i].apply(this, arguments);
			}
		};
	};

	/* one
	 *
	 * Create a function that will only execute once.
	 *
	 * Required:
	 *   [0] fn
	 *
	 * Return: fn that only fires once
	 */
	SonicUtils.one = function (fn) {
		var fired = false;

		return function () {
			if (fired) {
				return;
			}

			fired = true;

			return fn.apply(this, arguments);
		};
	};

	/* listeq
	 *
	 * Tests if the contents of two scalar
	 * arrays are equal. 
	 *
	 * Required:
	 *   [0] a: array
	 *	 [1] b: array
	 *
	 * Return: boolean
	 */
	SonicUtils.listeq = function (a, b) {
		if (!Array.isArray(a) || !Array.isArray(b)) {
			return false;
		}
		else if (a.length !== b.length) {
			return false;
		}

		for (var i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				return false;
			}
		}

		return true;
	};

	/* hasheq
	 *
	 * Tests if two objects are equal at a 
	 * shallow level. Intended to be used with
	 * scalar values.
	 *
	 * Required:
	 *   [0] a
	 *   [1] b
	 *
	 * Return: bool 
	 */
	SonicUtils.hasheq = function (a, b) {
		var akeys = Object.keys(a);

		if (!SonicUtils.listeq(akeys, Object.keys(b))) {
			return false;
		}

		for (var i = 0; i < akeys.length; i++) {
			var key = akeys[i];

			if (a[key] !== b[key]) {
				return false;
			}
		}

		return true;
	};

	/* flatten
	 *
	 * Take an array that potentially contains other arrays 
	 * and return them as a single array.
	 *
	 * e.g. flatten([1, 2, [3, [4]], 5]) => [1,2,3,4,5]
	 *
	 * Required: 
	 *   [0] array
	 * 
	 * Returns: array
	 */
	SonicUtils.flatten = function (array) {
		array = array || [];

		var flat = [];

		var len = array.length;
		for (var i = 0; i < len; i++) {
			var item = array[i];

			if (typeof(item) === 'object' && Array.isArray(item)) {
				flat = flat.concat(SonicUtils.flatten(item));
			}
			else {
				flat.push(item);
			}
		} 

		return flat;
	};

	/* arrayToHashKeys
	 *
	 * Converts [1,2,3,'a','b','c'] into
	 * { 1: true, 2: true, 3: true, 'a': true, 'b': true, 'c': true }
	 * so that you can e.g. efficiently test for existence.
	 *
	 * Required: 
	 *   [0] array: Contains only scalar values
	 * 
	 * Returns: { index1: true, ... }
	 */
	SonicUtils.arrayToHashKeys = function (array) {
		var hash = {};
		for (var i = array.length - 1; i >= 0; i--) {
			hash[array[i]] = true;
		}

		return hash;
	};

	/* forEachItem
	 *
	 * Iterate through each key/value in the hash
	 *
	 * Required:
	 *   [0] hash
	 *   [1] fn(key, value)
	 *
	 * Return: void (iteration construct)
	 */
	SonicUtils.forEachItem = function (hash, fn) {
		hash = hash || {};

		var keys = Object.keys(hash);
		keys.sort();

		keys.forEach(function (key) {
			fn(key, hash[key]);
		});
	};

	/* unique
	 *
	 * Take an array of elements and return only 
	 * unique values. This function respects
	 * the stability of the array based on
	 * first occurrence.
	 *
	 * Required:
	 *   [0] list: e.g. [ 1, 1, 4, 5, 2, 4 ]
	 *
	 * Return: [ e.g. 1, 4, 5, 2 ]
	 */
	SonicUtils.unique = function (list) {
		var obj = {};
		var order = [];
		list.forEach(function (item) {
			if (!obj[item]) {
				order.push(item);
			}

			obj[item] = true;
		});

		return order;
	};

	/* slice
	 *
	 * Gives a subset of the given hash.
	 *
	 * Required:
	 *   [0] hash
	 *   [1..n] keys to slice
	 *
	 * Return: hash slice
	 */
	SonicUtils.slice = function (hash) {
		var sliced = {};
		
		for (var i = 1; i < arguments.length; i++) {
			var key = arguments[i];
			sliced[key] = hash[key];
		}

		return sliced;
	};

	/* clamp
	 *
	 * Bound a value between a minimum and maximum value.
	 *
	 * Required: 
	 *   [0] value: The number to evaluate
	 *   [1] min: The minimum possible value
	 *   [2] max: The maximum possible value
	 * 
	 * Returns: value if value in [min,max], min if less, max if more
	 */
	SonicUtils.clamp = function (value, min, max) {
		return Math.max(Math.min(value, max), min);
	};

	/* indexOfAttr
	 *
	 * For use with arrays of objects. It's
	 * Array.indexOf but against an attribute
	 * of the array.
	 *
	 * Required: 
	 *   [0] value: searching for this
	 *   [1] array
	 *   [2] attr: e.g. description in [ { description }, { description } ]
	 * 
	 * Returns: index or -1 if not found
	 */
	SonicUtils.indexOfAttr = function (value, array, attr) {
		for (var i in array) {
			if (array[i][attr] === value) {
				return i;
			}
		}

		return -1;
	};

	/* invertHash
	 *
	 * Turns a key => value into value => key.
	 *
	 * Required:
	 *   [0] hash
	 *
	 * Return: inverted hash { value: key }
	 */
	SonicUtils.invertHash = function (hash) {
		hash = hash || {};

		var inversion = {};
		for (var key in hash) {
			if (!hash.hasOwnProperty(key)) { continue; }
			inversion[hash[key]] = key;
		}

		return inversion;
	};

	/* sumattr
	 *
	 * Since javascript doesn't do summing maps very gracefully,
	 * here's a hack to take care of a common case of a single
	 * level of depth.
	 *
	 * Required:
	 *   [0] list: array of numbers
	 *   [1] attr: The name of an attribute common to all the elements in list (e.g. list[0].attr )
	 *
	 * Returns: sum of all the attributes
	 */
	SonicUtils.sumattr = function (list, attr) {
		var total = 0;
		for (var i = list.length - 1; i >= 0; i--) {
			total += list[i][attr];
		};

		return total;		
	};

	/* sum
	 *
	 * Returns the sum off all the elements of an array.
	 *
	 * Required: 
	 *  [0] array of numbers
	 *
	 * Returns: sum of array
	 */
	SonicUtils.sum = function (list) {
		var total = 0;
		for (var i = list.length - 1; i >= 0; i--) {
			total += list[i];
		};

		return total;
	};

	/* median
	 *
	 * Given an array of numbers, returns the median.
	 *
	 * Required: array of numbers
	 *
	 * Returns: median
	 */
	SonicUtils.median = function (list) {
		list.sort();

		if (list.length === 0) {
			return null;
		}

		var middle = Math.ceil(list.length / 2);
		if (list.length % 2 === 0) {
			return (list[middle] + list[middle - 1]) / 2;
		}
		return list[middle];
	};

	/* truncate
	 *
	 * Provides a method of truncating the decimal 
	 * of a javascript number.
	 *
	 * Required:
	 *  [0] n: The number you wish to truncate
	 *
	 * Returns: The truncated number
	 */
	SonicUtils.truncate = function (n) {
		if (n > 0) {
			return Math.floor(n);
		}

		return Math.ceil(n);
	};

	/* seemingly_random
	 *
	 * A pseudo-random number generator that takes
	 * a seed. Useful for creating random seeming events
	 * that are coordinated across all players' computers.
	 *
	 * Cribbed from: http://stackoverflow.com/questions/521295/javascript-random-seeds
	 *
	 * Required: 
	 *   [0] seed
	 * 
	 * Returns: floating point [0, 1] determined by the seed 
	 * 
	 * NOTE: YOU MUST MANUALLY INCREMENT THE SEED YOURSELF
	 */
	SonicUtils.seemingly_random = function (seed) {
		var x = Math.sin(seed) * 10000;
		return x - Math.floor(x);
	};

	/* random_choice
	 *
	 * Selects a random element from an array with replacement.
	 *
	 * Required:
	 *   [0] array
	 *
	 * Returns: a uniformely randomly selected object from the array
	 */
	SonicUtils.random_choice = function (array) {
		if (!array.length) {
			return undefined;
		}

		var random_int = SonicUtils.random_index(array);

		return array[random_int];
	};

	/* random_index
	 *
	 * Selects a random element from an array with replacement.
	 *
	 * Required:
	 *   [0] array
	 *
	 * Returns: (int) a uniformly randomly selected index of the array, undefined if nothing in array
	 */
	SonicUtils.random_index = function (array) {
		if (!array.length) {
			return undefined;
		}

		return Math.round(Math.random() * (array.length - 1));
	};

	/* range
	 *
	 * Returns a range of numbers similar to python range.
	 *
	 * Required:
	 *   [0] end: e.g. 3
	 *
	 * Return: e.g. [ 0, 1, 2 ]
	 */
	SonicUtils.range = function (end) {
		var rng = [];
		for (var i = 0; i < end; i++) {
			rng.push(i);
		}

		return rng;
	};

	/* biased_random_choice
	 *
	 * Convenience function to select at random an element of an array using provided
	 * frequencies. C.f. biased_random_index.
     *
	 * Required: 
	 *   [0] array: A list of objects or numbers (if objects, you must set property)
	 *   
	 * Optional:
	 *   [1] property: If set, the weights will be assigned by mapping this property
	 *
	 * Returns: An element of the array or undefined if no elements are in there.
	 */
	SonicUtils.biased_random_choice = function (array, property) {
		if (!array.length) {
			return undefined;
		}

		var weights = array;
		if (property !== undefined) {
			weights = array.map(function (x) { return x[property]; });
		}

		var index = SonicUtils.biased_random_index(weights);

		return array[index];
	};


	/* biased_random_index
	 *
	 * Select an index at random with a probability equal to its relative
	 * proportion of weight.
	 * 
	 * Algorithm: 
	 *   1. Generate a random number betwen 0 and sum(weight)
	 *   2. Considering each cell as a bin of cubes on the number line
	 *      lined up next to each other, select the cell whose bin the random
	 *      number lands in.
	 *   3. If all the weights are 0, make a uniformly random choice.
     *
	 * Required: 
	 *   [0] weights: A numbers representing relative frequencies 
	 *		e.g. [1, 3, 1, 1], would return 1 twice as often as 0, 2, or 3
	 *
	 * Return: integer or undefined if weights has no length
	 */
	SonicUtils.biased_random_index = function (weights) {
		if (!weights.length) {
			return undefined;
		}

		var total = SonicUtils.sum(weights);

		if (total === 0) {
			return SonicUtils.random_index(weights);
		}

		var magicnumber = Math.random() * total;

		var accumulation = 0;
		for (var i = 0; i < weights.length; i++) {
			accumulation += weights[i];
			if (accumulation >= magicnumber) {
				return i;
			}
		}

		return SonicUtils.random_index(weights);
	};

	/* modulo
	 *
	 * Correctly deal with both positive and negative numbers in 
	 * modulo arithmetic.
	 *
	 * Required:
	 *   [0] a
	 *   [1] b
	 *
	 * Return: a % b even when the number is negative 
	 */
	SonicUtils.modulo = function (a, b) {
		return ((a % b) + b) % b;
	};


	SonicUtils.assert = function (cond, msg) {
		if (!cond) {
			throw new Error(msg);
		}
	};

	SonicUtils.assertDefined = function (x, msg) {
		if (x === undefined) {
			throw new Error(msg || "Variable was not defined.");
		}

		return x;
	};

})(jQuery || Zepto);