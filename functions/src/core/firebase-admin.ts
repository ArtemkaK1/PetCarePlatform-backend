import {getApp, getApps, initializeApp} from "firebase-admin/app";

export const adminApp = getApps().length === 0 ? initializeApp() : getApp();
