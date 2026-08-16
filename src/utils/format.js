// Tarih bicimlendirme yardimcisi (or. 11.08.2026 14:30)
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

module.exports = { formatDate };
