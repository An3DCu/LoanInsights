// 404: a voided receipt for the address that wasn't found. The address is the visitor's
// own text, so it only ever goes in with .text(), and a very long one is cut short.
const MAX_LENGTH = 60;

export function init($root) {
  const address = window.location.hash || '#/';
  const shown = address.length > MAX_LENGTH ? `${address.slice(0, MAX_LENGTH)}…` : address;
  $root.find('[data-field="address"]').text(shown);
}
