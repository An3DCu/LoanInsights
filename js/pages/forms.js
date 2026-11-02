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

// One field back to normal. setCustomValidity('') tells the browser it's valid again.
function clearField($input) {
  $input.removeClass('is-invalid').removeAttr('aria-invalid');
  $input.each((_, input) => input.setCustomValidity?.(''));
  $(`#${$input.attr('aria-describedby')}`).text('');
}

export function clearErrors($form) {
  clearField($form.find('.is-invalid'));
  $form.find('[data-form-error]').addClass('d-none').text('');
}

// Marks every field an error names: Bootstrap's is-invalid for the look, aria-invalid
// for screen readers, and setCustomValidity so the browser's own Constraint Validation
// API agrees (form.checkValidity() is false, the field matches :invalid). Focus goes to
// the first one. Errors without a field, and a count when there's more than one, show
// at the top of the form.
export function showErrors($form, errors) {
  const unplaced = [];
  let $first = null;
  for (const error of errors) {
    const $input = error instanceof LoanInputError ? field($form, error.field) : $();
    if (!$input.length) {
      if (!(error instanceof LoanInputError)) console.error(error);
      unplaced.push(error instanceof LoanInputError ? error.message : 'Something went wrong. Check the figures and try again.');
      continue;
    }
    $input.addClass('is-invalid').attr('aria-invalid', 'true');
    $input[0].setCustomValidity(error.message);
    $(`#${$input.attr('aria-describedby')}`).text(error.message);
    $first ??= $input;
  }

  const placed = errors.length - unplaced.length;
  const summary = [...unplaced];
  if (placed > 1) summary.unshift(`${placed} entries need a second look.`);
  if (summary.length) $form.find('[data-form-error]').removeClass('d-none').text(summary.join(' '));
  $first?.trigger('focus');
}

// A margin note: shown with its text, or hidden when there's nothing true to say (null).
export function showNote($note, text) {
  $note.text(text ?? '').toggleClass('d-none', !text);
}

// Editing a field that was marked wrong clears its mark, and the count at the top
// follows; the next "Work it out" checks everything again. Bound once, on document.
$(document).on('input change', 'form .is-invalid', (event) => {
  const $input = $(event.currentTarget);
  const $form = $input.closest('form');
  clearField($input);
  const left = $form.find('.is-invalid').length;
  const $summary = $form.find('[data-form-error]');
  if (left > 1) $summary.text(`${left} entries need a second look.`);
  else $summary.addClass('d-none').text('');
});

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
// swaps the page in again (event delegation). On submit:
// 1. check($form) lists every problem with the inputs; if there are any, all of them
//    are shown at once and nothing is calculated.
// 2. calculate($form) works out the result. It can still refuse (a payment that never
//    covers the interest), and that error is shown the same way.
// 3. render($section, result) fills in the results, which replace the empty state, and
//    the address becomes a link to them.
// On any error the old result is hidden, so nobody reads stale numbers.
export function handleSubmit({ form, results, check, calculate, render, route }) {
  $(document).on('submit', form, (event) => {
    event.preventDefault();
    const $form = $(event.currentTarget);
    const $section = $(results);
    const $empty = $(`[data-empty-for="${results}"]`);
    const fail = (errors) => {
      $section.addClass('d-none');
      $empty.removeClass('d-none');
      showErrors($form, errors);
    };

    clearErrors($form);
    const problems = check($form);
    if (problems.length) {
      fail(problems);
      return;
    }
    let result;
    try {
      result = calculate($form);
    } catch (error) {
      fail([error]);
      return;
    }
    render($section, result);
    $empty.addClass('d-none');
    $section.removeClass('d-none');
    writeLink($form, route);
  });
}
