// Helpers the calculator pages share: read a field, show and clear errors, and keep
// the form's values in the address so a result can be shared.
import { LoanInputError } from '../finance.js';
import { parseAmount } from '../format.js';
import { SHARE_FIELDS, fromQuery, toQuery } from '../share.js';

export function field($form, name) {
  return $form.find(`[name="${name}"]`);
}

export function readNumber($form, name) {
  return parseAmount(field($form, name).val());
}

export function clearErrors($form) {
  $form.find('.is-invalid').removeClass('is-invalid').removeAttr('aria-invalid');
  $form.find('.invalid-feedback').text('');
  $form.find('[data-form-error]').addClass('d-none').text('');
}

// Marks the field the error names, puts the message under it and moves focus there.
// Errors without a matching field show at the top of the form.
export function showError($form, error) {
  const $input = error instanceof LoanInputError ? field($form, error.field) : $();
  if ($input.length) {
    $input.addClass('is-invalid').attr('aria-invalid', 'true');
    $(`#${$input.attr('aria-describedby')}`).text(error.message);
    $input.trigger('focus');
    return;
  }
  if (!(error instanceof LoanInputError)) console.error(error);
  const message = error instanceof LoanInputError ? error.message : 'Something went wrong. Check the numbers and try again.';
  $form.find('[data-form-error]').removeClass('d-none').text(message);
}

// The form's shareable values: numbers as numbers (10000, not "10,000"), choices as
// they are. Fields that don't hold a number right now are left out of the link.
function shareableValues($form, fields) {
  const values = {};
  for (const name of Object.values(fields)) {
    const $input = field($form, name);
    if ($input.is(':radio')) {
      values[name] = $input.filter(':checked').val();
    } else if ($input.is('select')) {
      values[name] = $input.val();
    } else {
      const number = parseAmount($input.val());
      if (Number.isFinite(number)) values[name] = number;
    }
  }
  return values;
}

// After a good result, the address becomes a link to it. replaceState changes the
// address without a hashchange event, so the router doesn't reload the page, and
// without a new history entry, so Back still leaves the page.
function writeLink($form, route) {
  const query = toQuery(shareableValues($form, SHARE_FIELDS[route]), SHARE_FIELDS[route]);
  window.history.replaceState(null, '', `#${route}${query ? `?${query}` : ''}`);
}

// Opening a shared link: fill the form from the address and calculate right away.
// Returns false when the link carries nothing for this form.
export function restoreFromLink($form, params, route) {
  const values = fromQuery(params, SHARE_FIELDS[route]);
  if (Object.keys(values).length === 0) return false;
  for (const [name, value] of Object.entries(values)) {
    const $input = field($form, name);
    if ($input.is(':radio')) {
      $input.filter((_, radio) => radio.value === value).prop('checked', true).trigger('change');
    } else {
      $input.val(value);
    }
  }
  $form[0].requestSubmit();
  return true;
}

// Binds a form once, on document, so the handler keeps working every time the router
// swaps the page in again (event delegation). On submit it runs the calculation and
// hands the result to render. Any error goes to showError instead, and the old result
// is hidden so nobody reads stale numbers. A good result also updates the address.
export function handleSubmit(formSelector, resultsSelector, calculate, render, route) {
  $(document).on('submit', formSelector, (event) => {
    event.preventDefault();
    const $form = $(event.currentTarget);
    const $section = $(resultsSelector);
    clearErrors($form);
    let result;
    try {
      result = calculate($form);
    } catch (error) {
      $section.addClass('d-none');
      showError($form, error);
      return;
    }
    render($section, result);
    $section.removeClass('d-none');
    writeLink($form, route);
  });
}
