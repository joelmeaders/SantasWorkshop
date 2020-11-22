import * as functions from 'firebase-functions';

const rp = require('request-promise');

export default (data: any): Promise<boolean> => {
  const key = functions.config().recaptcha.key;
  const value = data.value;

  return rp({
    uri: 'https://www.google.com/recaptcha/api/siteverify',
    method: 'POST',
    formData: {
      secret: key,
      response: value,
    },
    json: true,
  })
    .then((result: any) => {
      if (result.success) {
        return true;
      } else {
        return false;
      }
    })
    .catch((reason: any) => {
      return false;
    });
};
