// WhatsApp attend un numero international sans "+" ni espaces : 06... -> 336...
function whatsappUrl(phone) {
  let digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `33${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

module.exports = { whatsappUrl };
