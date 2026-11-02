// Short confirmations ("saved as ...") as Bootstrap toasts, instead of the Toastr
// library the old site loaded. One dependency fewer. Screen readers get the message
// through the page's live region.
import { announce } from './announce.js';

export function showToast(message) {
  const $toast = $('<div class="toast">').append(
    $('<div class="toast-row">').append(
      $('<div class="toast-body">').text(message),
      $('<button class="btn-close" type="button" data-bs-dismiss="toast" aria-label="Close">'),
    ),
  );
  $('#toasts').append($toast);
  $toast.on('hidden.bs.toast', () => $toast.remove());
  window.bootstrap.Toast.getOrCreateInstance($toast[0]).show();
  announce(message);
}
