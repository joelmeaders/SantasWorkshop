import * as functions from 'firebase-functions';

let rp: any;

export default (data: any): Promise<boolean> => {
  if (!rp) {
    rp = require('request-promise');
  }

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
          console.log('failed recaptcha verification');
          return false;
        }
      })
      .catch((reason: any) => {
        console.error(`error: ${JSON.stringify(reason)}`);
        return false;
      });
};
