const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

/** Formats a number as Nigerian Naira, e.g. 27500 -> "₦27,500". */
export const formatNaira = (amount) => nairaFormatter.format(Number(amount) || 0);

export const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** Stock level label shown on product cards and the detail page. */
export const stockLabel = (quantity) => {
  if (quantity <= 0) return { text: 'Out of stock', tone: 'out' };
  if (quantity <= 5) return { text: `Only ${quantity} left`, tone: 'low' };
  return { text: 'In stock', tone: 'in' };
};
