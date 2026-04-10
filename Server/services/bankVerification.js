const axios = require('axios');

// Cache for storing verification results
const verificationCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Rate limiting
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Paystack bank codes mapping
const paystackBankCodes = {
  '044': '044', // Access Bank
  '023': '023', // Citibank
  '050': '050', // Ecobank
  '070': '070', // Fidelity
  '011': '011', // First Bank
  '058': '058', // GTBank
  '030': '030', // Heritage
  '301': '301', // Jaiz
  '082': '082', // Keystone
  '014': '014', // MainStreet
  '076': '076', // Polaris
  '039': '039', // Stanbic
  '232': '232', // Sterling
  '032': '032', // Union Bank
  '033': '033', // UBA
  '035': '035', // Wema
  '057': '057', // Zenith
  '101': '101', // Providus
  '215': '215', // Unity
  'OPAY': '999992', // OPay
  'PALMPAY': '999991', // PalmPay
  'KUDABANK': '999990', // Kuda Bank
  'MONEYS': '999989', // Moneypoint
  'ALAT': '999988', // ALAT by Wema
};

// Bank names mapping
const bankNames = {
  '044': 'Access Bank',
  '023': 'Citibank Nigeria',
  '050': 'Ecobank Nigeria',
  '070': 'Fidelity Bank',
  '011': 'First Bank of Nigeria',
  '058': 'Guaranty Trust Bank (GTBank)',
  '030': 'Heritage Bank',
  '301': 'Jaiz Bank',
  '082': 'Keystone Bank',
  '014': 'MainStreet Bank',
  '076': 'Polaris Bank',
  '039': 'Stanbic IBTC Bank',
  '232': 'Sterling Bank',
  '032': 'Union Bank of Nigeria',
  '033': 'United Bank for Africa (UBA)',
  '035': 'Wema Bank',
  '057': 'Zenith Bank',
  '101': 'Providus Bank',
  '215': 'Unity Bank',
  'OPAY': 'OPay',
  'PALMPAY': 'PalmPay',
  'KUDABANK': 'Kuda Bank',
  'MONEYS': 'Moneypoint',
  'ALAT': 'ALAT by Wema',
  'VAULTIX': 'Vaultix',
  '000': 'Vaultix',
  'OTHER': 'Other Bank'
};

/**
 * Check rate limit for IP or user
 */
const checkRateLimit = (identifier) => {
  const now = Date.now();
  const userRate = rateLimiter.get(identifier) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  // Reset if window has passed
  if (now > userRate.resetTime) {
    userRate.count = 1;
    userRate.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    userRate.count++;
  }
  
  rateLimiter.set(identifier, userRate);
  
  return userRate.count <= MAX_REQUESTS_PER_WINDOW;
};

/**
 * Get cached verification result
 */
const getCachedVerification = (accountNumber, bankCode) => {
  const cacheKey = `${bankCode}:${accountNumber}`;
  const cached = verificationCache.get(cacheKey);
  
  if (cached && cached.expiry > Date.now()) {
    console.log('📦 Using cached verification for:', accountNumber);
    return cached.data;
  }
  
  // Clean expired cache entries
  if (cached && cached.expiry <= Date.now()) {
    verificationCache.delete(cacheKey);
  }
  
  return null;
};

/**
 * Store verification result in cache
 */
const setCachedVerification = (accountNumber, bankCode, data) => {
  const cacheKey = `${bankCode}:${accountNumber}`;
  verificationCache.set(cacheKey, {
    data: data,
    expiry: Date.now() + CACHE_TTL
  });
  console.log('💾 Cached verification for:', accountNumber);
};

/**
 * Get bank name from code
 */
const getBankName = (bankCode) => {
  return bankNames[bankCode] || bankCode || 'Unknown Bank';
};

/**
 * Get Paystack bank code
 */
const getPaystackBankCode = (bankCode) => {
  return paystackBankCodes[bankCode] || bankCode;
};

/**
 * Verify bank account using Paystack API
 */
const verifyBankAccount = async (accountNumber, bankCode, userId = null) => {
  try {
    console.log('🔍 Verifying account:', { accountNumber, bankCode });
    
    // Validate account number format
    if (!accountNumber || accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
      return {
        success: false,
        message: 'Invalid account number format',
        data: {
          accountName: `${getBankName(bankCode)} Account Holder`,
          accountNumber: accountNumber,
          bankName: getBankName(bankCode),
          isFallback: true
        }
      };
    }
    
    // Check cache first
    const cached = getCachedVerification(accountNumber, bankCode);
    if (cached) {
      return {
        success: true,
        data: cached,
        fromCache: true
      };
    }
    
    // Check rate limit (if userId provided)
    if (userId) {
      const allowed = checkRateLimit(userId);
      if (!allowed) {
        console.log('⚠️ Rate limit exceeded for user:', userId);
        return {
          success: true,
          rateLimited: true,
          data: {
            accountName: `${getBankName(bankCode)} Account Holder`,
            accountNumber: accountNumber,
            bankName: getBankName(bankCode),
            isFallback: true
          }
        };
      }
    }
    
    // Check if Paystack is configured
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.log('⚠️ Paystack not configured. Using fallback verification.');
      const fallbackData = {
        accountName: `${getBankName(bankCode)} Account Holder`,
        accountNumber: accountNumber,
        bankName: getBankName(bankCode),
        isFallback: true
      };
      
      // Cache fallback for shorter time
      setCachedVerification(accountNumber, bankCode, fallbackData);
      
      return {
        success: true,
        data: fallbackData,
        usingFallback: true
      };
    }

    const paystackCode = getPaystackBankCode(bankCode);
    
    console.log(`🌐 Calling Paystack API: ${accountNumber} at ${bankCode} (${paystackCode})`);
    
    // Call Paystack API with timeout
    const response = await axios({
      method: 'get',
      url: 'https://api.paystack.co/bank/resolve',
      params: {
        account_number: accountNumber,
        bank_code: paystackCode
      },
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 seconds timeout
    });

    // Check if verification was successful
    if (response.data && response.data.status === true && response.data.data) {
      const accountName = response.data.data.account_name;
      
      console.log('✅ Account verified successfully:', accountName);
      
      const verificationData = {
        accountName: accountName,
        accountNumber: accountNumber,
        bankName: getBankName(bankCode),
        isFallback: false
      };
      
      // Cache successful verification
      setCachedVerification(accountNumber, bankCode, verificationData);
      
      return {
        success: true,
        data: verificationData
      };
    } else {
      throw new Error(response.data?.message || 'Verification failed');
    }
    
  } catch (error) {
    console.error('❌ Paystack verification error:', error.message);
    
    // Handle specific error cases
    if (error.response) {
      const status = error.response.status;
      
      if (status === 429) {
        console.log('⚠️ Rate limit exceeded. Using fallback verification.');
      } else if (status === 400) {
        console.log('⚠️ Invalid request to Paystack. Using fallback verification.');
      } else if (status === 401) {
        console.log('⚠️ Invalid Paystack API key. Using fallback verification.');
      } else if (status === 404) {
        return {
          success: false,
          message: 'Account not found or cannot be verified',
          data: {
            accountName: `${getBankName(bankCode)} Account Holder`,
            accountNumber: accountNumber,
            bankName: getBankName(bankCode),
            isFallback: true
          }
        };
      }
    } else if (error.code === 'ECONNABORTED') {
      console.log('⚠️ Paystack request timeout. Using fallback verification.');
    } else if (error.code === 'ENOTFOUND') {
      console.log('⚠️ Network error. Cannot reach Paystack. Using fallback verification.');
    }
    
    // Return fallback verification
    const fallbackData = {
      accountName: `${getBankName(bankCode)} Account Holder`,
      accountNumber: accountNumber,
      bankName: getBankName(bankCode),
      isFallback: true
    };
    
    // Cache fallback for shorter time (5 minutes)
    const cacheKey = `${bankCode}:${accountNumber}`;
    verificationCache.set(cacheKey, {
      data: fallbackData,
      expiry: Date.now() + (5 * 60 * 1000) // 5 minutes for fallback
    });
    
    return {
      success: true,
      data: fallbackData,
      usingFallback: true,
      errorReason: error.message
    };
  }
};

/**
 * Get list of all supported banks
 */
const getBankList = async () => {
  try {
    // Return from cache if available
    const cached = verificationCache.get('bankList');
    if (cached && cached.expiry > Date.now()) {
      console.log('📦 Using cached bank list');
      return {
        success: true,
        data: cached.data,
        fromCache: true
      };
    }
    
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.log('⚠️ Paystack not configured. Returning static bank list.');
      const staticList = Object.entries(bankNames).map(([code, name]) => ({ code, name }));
      return {
        success: true,
        data: staticList
      };
    }

    const response = await axios({
      method: 'get',
      url: 'https://api.paystack.co/bank',
      params: { country: 'nigeria', perPage: 100 },
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && response.data.status === true) {
      const banks = response.data.data.map(bank => ({
        code: bank.code,
        name: bank.name
      }));
      
      // Add Vaultix as internal bank
      banks.unshift({ code: 'VAULTIX', name: 'Vaultix (Internal Transfer)' });
      
      // Cache bank list for 24 hours
      verificationCache.set('bankList', {
        data: banks,
        expiry: Date.now() + (24 * 60 * 60 * 1000)
      });
      
      return {
        success: true,
        data: banks
      };
    }
    
    throw new Error('Failed to fetch bank list');
    
  } catch (error) {
    console.error('❌ Error fetching bank list:', error.message);
    
    // Return static bank list as fallback
    const staticList = Object.entries(bankNames)
      .filter(([code]) => code !== 'OTHER' && code !== '000')
      .map(([code, name]) => ({ code, name }));
    
    staticList.unshift({ code: 'VAULTIX', name: 'Vaultix (Internal Transfer)' });
    
    return {
      success: true,
      data: staticList,
      usingFallback: true
    };
  }
};

/**
 * Clear cache (useful for testing)
 */
const clearCache = () => {
  verificationCache.clear();
  rateLimiter.clear();
  console.log('🧹 Cache cleared');
};

/**
 * Get cache stats
 */
const getCacheStats = () => {
  return {
    verificationCacheSize: verificationCache.size,
    rateLimiterSize: rateLimiter.size,
    cacheKeys: Array.from(verificationCache.keys())
  };
};

module.exports = {
  verifyBankAccount,
  getBankList,
  getBankName,
  getPaystackBankCode,
  clearCache,
  getCacheStats,
  paystackBankCodes,
  bankNames
};