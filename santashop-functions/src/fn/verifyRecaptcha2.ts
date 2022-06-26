import * as functions from 'firebase-functions';
import * as https from 'https';

export default (inputData: any): Promise<any> => {
  const key = functions.config().recaptcha.key;
  const value = inputData.value;

  const options: https.RequestOptions = {
    hostname: 'google.com',
    port: 443,
    path: `/recaptcha/api/siteverify?secret=${key}&response=${value}`,
    method: 'POST',
  };

  return new Promise(function (resolve, reject) {
    const request = https.request(options, function (res) {
      // on bad status, reject
      if (res.statusCode! < 200 || res.statusCode! >= 300) {
        return reject(new Error('statusCode=' + res.statusCode));
      }
      // on response data, cumulate it
      const body = new Array<any>();
      res.on('data', function (chunk) {
        body.push(chunk);
      });
      // on end, parse and resolve
      res.on('end', function () {
        let data: any;
        try {
          data = JSON.parse(Buffer.concat(body).toString());
        } catch (e) {
          reject(e);
        }
        resolve(data);
      });
    });
    // reject on request error
    request.on('error', function (err) {
      reject(err);
    });
    request.end();
  });
};
