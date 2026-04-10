export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₦0';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

export const maskAccountNumber = (accountNumber) => {
  if (!accountNumber) return '•••• •••• ••';
  if (accountNumber.length >= 10) {
    return `${accountNumber.slice(0, 4)} •••• •••• ${accountNumber.slice(-2)}`;
  }
  return accountNumber;
};

export const maskCardNumber = (cardNumber) => {
  if (!cardNumber) return '•••• •••• •••• ••••';
  return cardNumber.replace(/(\d{4})/g, '$1 ').trim();
};

export const formatAccountNumber = (accountNumber) => {
  if (!accountNumber) return '•••• •••• ••';
  if (accountNumber.length >= 10) {
    return `${accountNumber.slice(0, 4)} ${accountNumber.slice(4, 8)} ${accountNumber.slice(8, 10)}`;
  }
  return accountNumber;
};