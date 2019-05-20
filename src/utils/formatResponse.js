import { PAYLOAD, RECORDS_RESULTS, RECORDS } from "../constants/responseFormats";
import { OBJECT, ARRAY, SINGLE } from "../constants/responseFormatTypes";

const identity = (val) => val;

export const responseFormatters = {
  [RECORDS_RESULTS]: {
    [OBJECT]: payload => {
      payload.formattedResponse = payload.recordsResults || null;
      return payload.formattedResponse;
    },
    [ARRAY]: payload => {
      const { recordsResults } = payload;
      payload.formattedResponse = recordsResults ? Object.values(recordsResults) : null;
      return payload.formattedResponse;
    },
    [SINGLE]: payload => {
      const { recordsResults } = payload;
      payload.formattedResponse = recordsResults ? Object.values(recordsResults)[0] : null;
      return payload.formattedResponse;
    }
  },
  [RECORDS]: {
    [OBJECT]: payload => {
      payload.formattedResponse = payload.records || null
      return payload.formattedResponse;
    },
    [ARRAY]: payload => {
      const { records } = payload;
      payload.formattedResponse = records ? Object.values(records) : null;
      return payload.formattedResponse;
    },
    [SINGLE]: payload => {
      const { records } = payload;
      payload.formattedResponse = records ? Object.values(records)[0] : null;
      return payload.formattedResponse;
    }
  },
  [PAYLOAD]: {
    [OBJECT]: identity,
    [ARRAY]: identity,
    [SINGLE]: identity
  }
};

function formatResponse(payload) {
  const { responseFormat, responseFormatType } = payload;
  // save it to the payload since this could be for a mutation,
  // which will need to access it from the payload and not the
  // return stream.
  payload.formattedResponse = responseFormatters[responseFormat][responseFormatType](payload);
  return payload.formattedResponse;
}

export default formatResponse;


