const axios = require('axios');

let cachedToken = null;
let tokenExpiresAt = 0;

const getBaseUrl = () => process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';

const getAccessToken = async () => {
  if (cachedToken && tokenExpiresAt > Date.now() + 30000) {
    return cachedToken;
  }

  if (!process.env.MONNIFY_API_KEY || !process.env.MONNIFY_SECRET_KEY) {
    throw new Error('Monnify is not configured on the server.');
  }

  const credentials = Buffer.from(
    `${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`
  ).toString('base64');

  const response = await axios.post(
    `${getBaseUrl()}/api/v1/auth/login`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );

  if (!response.data?.requestSuccessful || !response.data?.responseBody?.accessToken) {
    throw new Error(response.data?.responseMessage || 'Monnify authentication failed.');
  }

  cachedToken = response.data.responseBody.accessToken;
  tokenExpiresAt = Date.now() + Number(response.data.responseBody.expiresIn || 300) * 1000;
  return cachedToken;
};

const initiateTransfer = async ({
  accountNumber,
  bankCode,
  accountName,
  amount,
  reason,
  reference
}) => {
  if (process.env.MONNIFY_TRANSFERS_ENABLED !== 'true') {
    throw new Error('Monnify transfers are not enabled on this server.');
  }

  if (!process.env.MONNIFY_SOURCE_ACCOUNT) {
    throw new Error('Monnify source account is not configured on the server.');
  }

  const token = await getAccessToken();
  const response = await axios.post(
    `${getBaseUrl()}/api/v1/disbursements/single`,
    {
      amount: Number(amount),
      reference,
      narration: reason || 'Vaultix wallet withdrawal',
      destinationBankCode: bankCode,
      destinationAccountNumber: accountNumber,
      destinationAccountName: accountName,
      currency: 'NGN',
      sourceAccountNumber: process.env.MONNIFY_SOURCE_ACCOUNT
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );

  if (!response.data?.requestSuccessful) {
    throw new Error(response.data?.responseMessage || 'Monnify transfer failed to start.');
  }

  const transfer = response.data.responseBody || {};
  return {
    reference: transfer.reference || transfer.transactionReference || reference,
    status: transfer.status || 'PENDING',
    raw: transfer
  };
};

module.exports = { initiateTransfer };
