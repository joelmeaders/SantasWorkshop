/// <reference types="express" />
import * as functions from 'firebase-functions';
export declare const trackCollectionMeta: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
export declare const modCounter: functions.TriggerAnnotated & ((req: functions.Request<import("express-serve-static-core").ParamsDictionary>, resp: functions.Response<any>) => void | Promise<void>) & functions.Runnable<any>;
export declare const generateQrCode: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
export declare const sendRegistrationEmail: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
export declare const deleteAccount: functions.TriggerAnnotated & ((req: functions.Request<import("express-serve-static-core").ParamsDictionary>, resp: functions.Response<any>) => void | Promise<void>) & functions.Runnable<any>;
