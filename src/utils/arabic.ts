export const toArabicNumeral = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '٠';
  const str = String(num);
  return str.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)]);
};
