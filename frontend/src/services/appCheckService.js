import { getToken } from 'firebase/app-check';
import { appCheck } from '../firebase';

export async function getAppCheckHeaders() {
  if (!appCheck) {
    return {};
  }

  try {
    const tokenResult = await getToken(appCheck, false);
    if (tokenResult?.token) {
      return { 'X-Firebase-AppCheck': tokenResult.token };
    }
  } catch (error) {
    // App Check is optional during monitoring mode.
  }

  return {};
}
