
var Music = Music || {};
Music.Mixins = {};

(function (undefined) {
	"use strict";

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
	Music.Mixins.perceptualVolume = function (obj, vol) {
		if (vol === undefined) {
			return Music.Mixins.gainToPerceptualVolume(obj.volume());
		}

		vol = vol || 0;

		if (vol <= 0.005) {
			vol = 0;
		}
		else {
			vol = 0.01 * Math.exp(4.605 * vol); // calibrated for 70 dB (A)
		}

		return obj.volume(vol);
	};

	Music.Mixins.gainToPerceptualVolume = function (vol) {
		vol = vol || 0;

		return 0.01 * Math.exp(4.605 * vol); // calibrated for 70 dB (A)
	};
})();