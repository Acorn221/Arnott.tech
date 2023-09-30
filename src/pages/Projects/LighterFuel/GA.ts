/* eslint-disable no-restricted-globals */
/* eslint-disable import/prefer-default-export */
if (!import.meta.env.VITE_PUBLIC_GTAG_ID) {
  throw new Error('VITE_PUBLIC_GTAG_ID environment variable not set.');
}

if (!import.meta.env.VITE_PUBLIC_SECRET_API_KEY) {
  throw new Error('VITE_PUBLIC_SECRET_API_KEY environment variable not set.');
}

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const gtagId = import.meta.env.VITE_PUBLIC_GTAG_ID;
const secretApiKey = import.meta.env.VITE_PUBLIC_SECRET_API_KEY;

// https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events
type CollectEventPayload = {
	name: string,
	params?: any,
};

/**
 * This function sends events to Google Analytics using the Measurement Protocol.
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events
 *
 * @param events The events to send to Google Analytics.
 */
export const AnalyticsEvent = async (events: CollectEventPayload[]) => {
  const clientId = self.crypto.randomUUID();

  await fetch(
    `${GA_ENDPOINT}?measurement_id=${gtagId}&api_secret=${secretApiKey}`,
    {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        events,
      }),
    },
  );
};
