const OPEN_ROUTE_SERVICE_HOST_PATTERN = /(^|\.)openrouteservice\.org$/i;

function isOpenRouteServiceHost(value) {
  try {
    const parsed = new URL(value);
    return OPEN_ROUTE_SERVICE_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Resolve a Cloud Function proxy URL with guardrails against accidental direct provider calls.
 */
export function resolveFunctionProxyUrl({
  configuredUrl,
  projectId,
  functionsRegion,
  emulatorHost,
  useEmulator,
  functionName,
}) {
  if (configuredUrl) {
    if (isOpenRouteServiceHost(configuredUrl)) {
      console.warn(
        `Ignoring configured ${functionName} proxy URL because it points to OpenRouteService directly.`
      );
    } else {
      return configuredUrl;
    }
  }

  if (!projectId) {
    return null;
  }

  if (useEmulator) {
    return `http://${emulatorHost}:5001/${projectId}/${functionsRegion}/${functionName}`;
  }

  return `https://${functionsRegion}-${projectId}.cloudfunctions.net/${functionName}`;
}
