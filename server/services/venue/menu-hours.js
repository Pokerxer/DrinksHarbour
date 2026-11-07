'use strict';
const { assertPresetOpen } = require('./presets');
function sectionHoursOpen({
  profile,
  presets = [],
  at = new Date(),
  timezone,
}) {
  try {
    if (profile)
      assertPresetOpen(profile.hours, profile.exceptions, at, timezone);
    for (const preset of presets)
      assertPresetOpen(preset.hours, preset.exceptions, at, timezone);
    return true;
  } catch (error) {
    if (error.code === 'PRESET_CLOSED') return false;
    throw error;
  }
}
module.exports = { sectionHoursOpen };
