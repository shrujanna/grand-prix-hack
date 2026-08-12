export const gpTimezones: Record<string, string> = {
  'Monaco': 'Europe/Monaco',
  'Bahrain': 'Asia/Bahrain',
  'Saudi Arabia': 'Asia/Riyadh',
  'Australia': 'Australia/Melbourne',
  'Azerbaijan': 'Asia/Baku',
  'Miami': 'America/New_York',
  'Emilia Romagna': 'Europe/Rome',
  'Spain': 'Europe/Madrid',
  'Canada': 'America/Toronto',
  'Austria': 'Europe/Vienna',
  'Great Britain': 'Europe/London',
  'Hungary': 'Europe/Budapest',
  'Belgium': 'Europe/Brussels',
  'Netherlands': 'Europe/Amsterdam',
  'Italy': 'Europe/Rome',
  'Singapore': 'Asia/Singapore',
  'Japan': 'Asia/Tokyo',
  'Qatar': 'Asia/Qatar',
  'United States': 'America/Chicago', // COTA is Central Time
  'Mexico': 'America/Mexico_City',
  'Brazil': 'America/Sao_Paulo',
  'Las Vegas': 'America/Los_Angeles',
  'Abu Dhabi': 'Asia/Dubai',
};

export const formatTrackTime = (dateString: string, gp?: string) => {
  const date = new Date(dateString);
  const timeZone = gp && gpTimezones[gp] ? gpTimezones[gp] : 'UTC';
  try {
    return date.toLocaleTimeString('en-US', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    // Fallback if timezone string is invalid in this browser
    return date.toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour12: false,
      timeZoneName: 'short'
    });
  }
};
