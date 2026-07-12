// Stand-in for the `resend` npm package. The domain-verification race lives
// entirely in the database transitions; email delivery is an unrelated side
// effect. Stubbing it keeps the reproduction hermetic (no outbound HTTPS) and
// records what *would* have been sent so the script can show the mis-directed
// "superseded" notifications the race produces.
export const sentBatches = [];

export class Resend {
  constructor(_apiKey) {
    this.batch = {
      send: async (payloads) => {
        sentBatches.push(payloads);
        return { data: { data: [] }, error: null };
      },
    };
    this.emails = {
      send: async (payload) => {
        sentBatches.push([payload]);
        return { data: {}, error: null };
      },
    };
  }
}

export default { Resend };
