const axios = require('axios');

const SMSGATE_DEFAULT_API_URL = 'https://api.sms-gate.app/3rdparty/v1/message';
const SMSGATE_DEFAULT_TIMEOUT_MS = 15000;
const SMSGATE_PENDING_STATE = 'pending';

function normalizePhoneNumber(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  if (input.startsWith('+')) {
    return input;
  }

  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('63')) return `+${digits}`;
  if (digits.startsWith('0')) return `+63${digits.slice(1)}`;
  return `+63${digits}`;
}

function createSmsGateError({ code, message, status, retriable, details }) {
  const err = new Error(message || 'SMS gate request failed');
  err.code = code || 'smsgate_error';
  err.status = status || null;
  err.retriable = retriable === true;
  err.details = details || null;
  return err;
}

function mapSmsGateError(error) {
  const status = error?.response?.status || null;
  const responseData = error?.response?.data || null;
  const timeout = error?.code === 'ECONNABORTED';
  const networkCodes = ['ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'ETIMEDOUT'];
  const networkFailure = timeout || networkCodes.includes(String(error?.code || '').toUpperCase());
  const retriableStatus = status === 408 || status === 429 || (status >= 500 && status <= 599);

  return createSmsGateError({
    code: responseData?.code || error?.code || 'smsgate_request_failed',
    message: responseData?.message || error?.message || 'SMS gate request failed',
    status,
    retriable: networkFailure || retriableStatus,
    details: responseData,
  });
}

function resolveRuntimeConfig(config = {}) {
  const apiUrl = String(config.apiUrl || process.env.SMSGATE_API_URL || SMSGATE_DEFAULT_API_URL).trim();
  const username = String(config.username || process.env.SMSGATE_USERNAME || '').trim();
  const password = String(config.password || process.env.SMSGATE_PASSWORD || '').trim();
  const timeoutMs = Math.min(
    Math.max(Number(config.timeoutMs || process.env.SMSGATE_TIMEOUT_MS || SMSGATE_DEFAULT_TIMEOUT_MS), 1000),
    60000
  );

  return { apiUrl, username, password, timeoutMs };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeState(value) {
  return String(value || '').trim().toLowerCase();
}

async function sendSmsViaSmsGate({ to, message, config = {} }) {
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) {
    throw createSmsGateError({
      code: 'invalid_phone',
      message: 'Recipient phone number is invalid',
      retriable: false,
    });
  }

  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    throw createSmsGateError({
      code: 'invalid_message',
      message: 'SMS message is required',
      retriable: false,
    });
  }

  const runtime = resolveRuntimeConfig(config);
  if (!runtime.username || !runtime.password) {
    throw createSmsGateError({
      code: 'missing_credentials',
      message: 'SMS gate credentials are not configured',
      retriable: false,
    });
  }

  const payload = {
    phoneNumbers: [normalizedTo],
    textMessage: {
      text: normalizedMessage,
    },
  };

  try {
    const response = await axios.post(runtime.apiUrl, payload, {
      auth: {
        username: runtime.username,
        password: runtime.password,
      },
      timeout: runtime.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return {
      ok: true,
      status: response.status,
      data: response.data || null,
      to: normalizedTo,
    };
  } catch (error) {
    throw mapSmsGateError(error);
  }
}

async function getSmsGateMessageById({ messageId, config = {} }) {
  const normalizedMessageId = String(messageId || '').trim();
  if (!normalizedMessageId) {
    throw createSmsGateError({
      code: 'invalid_message_id',
      message: 'SMS gate message id is required',
      retriable: false,
    });
  }

  const runtime = resolveRuntimeConfig(config);
  if (!runtime.username || !runtime.password) {
    throw createSmsGateError({
      code: 'missing_credentials',
      message: 'SMS gate credentials are not configured',
      retriable: false,
    });
  }

  try {
    const response = await axios.get(`${runtime.apiUrl}/${encodeURIComponent(normalizedMessageId)}`, {
      auth: {
        username: runtime.username,
        password: runtime.password,
      },
      timeout: runtime.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return {
      ok: true,
      status: response.status,
      data: response.data || null,
      messageId: normalizedMessageId,
    };
  } catch (error) {
    throw mapSmsGateError(error);
  }
}

async function waitForSmsGateFinalState({
  messageId,
  config = {},
  maxWaitMs = 45000,
  pollIntervalMs = 2000,
}) {
  const normalizedMessageId = String(messageId || '').trim();
  if (!normalizedMessageId) {
    throw createSmsGateError({
      code: 'invalid_message_id',
      message: 'SMS gate message id is required',
      retriable: false,
    });
  }

  const normalizedMaxWaitMs = Math.min(Math.max(Number(maxWaitMs || 45000), 2000), 120000);
  const normalizedPollIntervalMs = Math.min(Math.max(Number(pollIntervalMs || 2000), 500), 10000);
  const startedAtMs = Date.now();
  let latestData = null;

  while (Date.now() - startedAtMs <= normalizedMaxWaitMs) {
    const lookup = await getSmsGateMessageById({
      messageId: normalizedMessageId,
      config,
    });
    latestData = lookup.data || null;
    const messageState = normalizeState(latestData?.state);
    const recipientState = normalizeState(latestData?.recipients?.[0]?.state);
    const effectiveState = recipientState || messageState;

    if (effectiveState && effectiveState !== SMSGATE_PENDING_STATE) {
      return {
        final: true,
        messageId: normalizedMessageId,
        state: latestData?.state || null,
        recipientState: latestData?.recipients?.[0]?.state || null,
        recipientError: latestData?.recipients?.[0]?.error || null,
        elapsedMs: Date.now() - startedAtMs,
        data: latestData,
      };
    }

    await sleep(normalizedPollIntervalMs);
  }

  return {
    final: false,
    messageId: normalizedMessageId,
    state: latestData?.state || null,
    recipientState: latestData?.recipients?.[0]?.state || null,
    recipientError: latestData?.recipients?.[0]?.error || null,
    elapsedMs: Date.now() - startedAtMs,
    data: latestData,
  };
}

module.exports = {
  normalizePhoneNumber,
  sendSmsViaSmsGate,
  getSmsGateMessageById,
  waitForSmsGateFinalState,
};
