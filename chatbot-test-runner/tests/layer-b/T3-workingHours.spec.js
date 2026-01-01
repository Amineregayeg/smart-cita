/**
 * T3: Working Hours Compliance Tests
 * Verifies chatbot respects center-specific working hours
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');
const smartAgenda = require('../../lib/smartAgendaClient');

/**
 * Parse time string to minutes from midnight
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Check if time is within working hours
 */
function isWithinWorkingHours(time, openTime, closeTime) {
  const t = timeToMinutes(time);
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  return t >= open && t < close;
}

/**
 * T3.1: Madrid working hours
 */
const testMadridWorkingHours = defineTest(
  'T3.1-MADRID-HOURS',
  'Madrid: All slots within working hours',
  'working-hours',
  async ({ policy }) => {
    const center = policy.centers['madrid'];
    const hours = policy.workingHours['madrid'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const slots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    for (const day of slots) {
      const dayOfWeek = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
      const dayHours = hours[dayOfWeek];

      if (!dayHours || dayHours.closed) {
        if (day.times.length > 0) {
          return {
            passed: false,
            error: `Slots available on closed day: ${day.date} (${dayOfWeek})`,
            expected: 'No slots on closed days',
            actual: day.times
          };
        }
        continue;
      }

      for (const time of day.times) {
        if (!isWithinWorkingHours(time, dayHours.open, dayHours.close)) {
          return {
            passed: false,
            error: `Slot ${time} outside working hours ${dayHours.open}-${dayHours.close} on ${day.date}`,
            expected: `Within ${dayHours.open}-${dayHours.close}`,
            actual: time
          };
        }
      }
    }

    return { passed: true };
  }
);

/**
 * T3.2: Barcelona working hours
 */
const testBarcelonaWorkingHours = defineTest(
  'T3.2-BARCELONA-HOURS',
  'Barcelona: All slots within working hours',
  'working-hours',
  async ({ policy }) => {
    const center = policy.centers['barcelona'];
    const hours = policy.workingHours['barcelona'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const slots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    for (const day of slots) {
      const dayOfWeek = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
      const dayHours = hours[dayOfWeek];

      if (!dayHours || dayHours.closed) {
        if (day.times.length > 0) {
          return {
            passed: false,
            error: `Slots available on closed day: ${day.date}`,
            expected: 'No slots on closed days',
            actual: day.times
          };
        }
        continue;
      }

      for (const time of day.times) {
        if (!isWithinWorkingHours(time, dayHours.open, dayHours.close)) {
          return {
            passed: false,
            error: `Slot ${time} outside working hours on ${day.date}`,
            expected: `Within ${dayHours.open}-${dayHours.close}`,
            actual: time
          };
        }
      }
    }

    return { passed: true };
  }
);

/**
 * T3.3: No Sunday bookings (most centers)
 */
const testNoSundayBookings = defineTest(
  'T3.3-NO-SUNDAY',
  'No appointments available on Sundays',
  'working-hours',
  async ({ policy }) => {
    const centers = ['madrid', 'barcelona', 'sevilla', 'valencia', 'bilbao'];

    for (const centerName of centers) {
      const center = policy.centers[centerName];
      if (!center) continue;

      const hours = policy.workingHours[centerName];
      if (!hours?.sun?.closed) continue; // Skip if Sunday not marked closed

      const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);

      const slots = await smartAgenda.getAvailability(
        center.agendaId,
        treatmentType,
        today.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      for (const day of slots) {
        const date = new Date(day.date);
        if (date.getDay() === 0 && day.times.length > 0) {
          return {
            passed: false,
            error: `Sunday slots found for ${centerName}: ${day.date}`,
            expected: 'No Sunday slots',
            actual: day.times
          };
        }
      }
    }

    return { passed: true };
  }
);

/**
 * T3.4: Chatbot respects lunch break (if applicable)
 */
const testLunchBreakRespected = defineTest(
  'T3.4-LUNCH-BREAK',
  'No slots during lunch break hours',
  'working-hours',
  async ({ policy }) => {
    // Check centers that have lunch breaks defined
    const centersWithLunch = Object.keys(policy.workingHours).filter(c =>
      policy.workingHours[c]?.mon?.lunchStart
    );

    if (centersWithLunch.length === 0) {
      return { passed: true }; // No lunch breaks configured
    }

    for (const centerName of centersWithLunch) {
      const center = policy.centers[centerName];
      if (!center) continue;

      const hours = policy.workingHours[centerName];
      const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 14);

      const slots = await smartAgenda.getAvailability(
        center.agendaId,
        treatmentType,
        today.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      for (const day of slots) {
        const dayOfWeek = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        const dayHours = hours[dayOfWeek];

        if (!dayHours?.lunchStart) continue;

        const lunchStart = timeToMinutes(dayHours.lunchStart);
        const lunchEnd = timeToMinutes(dayHours.lunchEnd);

        for (const time of day.times) {
          const t = timeToMinutes(time);
          if (t >= lunchStart && t < lunchEnd) {
            return {
              passed: false,
              error: `Slot ${time} during lunch break ${dayHours.lunchStart}-${dayHours.lunchEnd}`,
              expected: 'No lunch break slots',
              actual: time
            };
          }
        }
      }
    }

    return { passed: true };
  }
);

/**
 * T3.5: End of day buffer (appointment must end before close)
 */
const testEndOfDayBuffer = defineTest(
  'T3.5-EOD-BUFFER',
  'Appointments end before closing time',
  'working-hours',
  async ({ policy }) => {
    const centerName = 'madrid';
    const center = policy.centers[centerName];
    const hours = policy.workingHours[centerName];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;
    const duration = policy.treatments.tabaco?.duration || 60;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const slots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    for (const day of slots) {
      const dayOfWeek = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
      const dayHours = hours[dayOfWeek];

      if (!dayHours || dayHours.closed) continue;

      const closeMinutes = timeToMinutes(dayHours.close);

      for (const time of day.times) {
        const startMinutes = timeToMinutes(time);
        const endMinutes = startMinutes + duration;

        if (endMinutes > closeMinutes) {
          return {
            passed: false,
            error: `Appointment at ${time} would end at ${Math.floor(endMinutes / 60)}:${(endMinutes % 60).toString().padStart(2, '0')}, after close ${dayHours.close}`,
            expected: `End before ${dayHours.close}`,
            actual: `Ends at ${Math.floor(endMinutes / 60)}:${(endMinutes % 60).toString().padStart(2, '0')}`
          };
        }
      }
    }

    return { passed: true };
  }
);

module.exports = {
  name: 'T3 - Working Hours Compliance',
  tests: [
    testMadridWorkingHours,
    testBarcelonaWorkingHours,
    testNoSundayBookings,
    testLunchBreakRespected,
    testEndOfDayBuffer
  ]
};
