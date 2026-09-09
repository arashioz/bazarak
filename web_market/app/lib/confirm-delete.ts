export const confirmDelete = (subject: string) =>
  window.confirm(`حذف ${subject}؟`) &&
  window.confirm(`تأیید نهایی: «${subject}» برای همیشه حذف شود؟ این عمل قابل بازگشت نیست.`);
