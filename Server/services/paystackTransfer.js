const axios = require('axios');

const paystackBankCodes = {
  OPAY: '999992',
  PALMPAY: '999991',
  KUDABANK: '999990',
  MONIEPOINT: '50515'
};

const getBankCode = (bankCode) => paystackBankCodes[bankCode] || bankCode;

const paystackRequest = (method, url, data) => axios({
  method,
  url: `https://api.paystack.co${url}`,
  data,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 20000
});

const initiateTransfer = async ({ accountNumber, bankCode, accountName, amount, reason, reference }) => {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack is not configured on the server.');
  }

  try {
    const recipientResponse = await paystackRequest('post', '/transferrecipient', {
      type: 'nuban',
      name: accountName,
      account_number: accountNumber,
      bank_code: getBankCode(bankCode),
      currency: 'NGN'
    });

    if (!recipientResponse.data?.status || !recipientResponse.data?.data?.recipient_code) {
      throw new Error(recipientResponse.data?.message || 'Could not create transfer recipient.');
    }

    const transferResponse = await paystackRequest('post', '/transfer', {
      source: 'balance',
      amount: Math.round(Number(amount) * 100),
      recipient: recipientResponse.data.data.recipient_code,
      reason: reason || 'Vaultix wallet transfer',
      reference,
      currency: 'NGN'
    });

    if (!transferResponse.data?.status || !transferResponse.data?.data) {
      throw new Error(transferResponse.data?.message || 'Paystack transfer failed to start.');
    }

    return transferResponse.data.data;
  } catch (err) {
    // Map Paystack errors to user-friendly messages
    const raw = (err.response?.data?.message || '').toLowerCase();
    if (raw.includes('starter business') || raw.includes('third party payout') || raw.includes('not enabled')) {
      throw new Error('External bank transfers are currently unavailable. Please try a Vaultix-to-Vaultix transfer or contact support.');
    }
    if (raw.includes('insufficient') || raw.includes('balance')) {
      throw new Error('Insufficient funds in the transfer pool. Please try again later or contact support.');
    }
    if (raw.includes('invalid account') || raw.includes('account number')) {
      throw new Error('The recipient account number is invalid. Please double-check and try again.');
    }
    if (raw.includes('invalid bank') || raw.includes('bank code')) {
      throw new Error('The selected bank is not supported for transfers at this time.');
    }
    if (raw.includes('duplicate') || raw.includes('already')) {
      throw new Error('A transfer with this reference already exists. Please try again.');
    }
    if (raw) {
      throw new Error(err.response.data.message);
    }
    throw err;
  }
};

module.exports = { initiateTransfer };
