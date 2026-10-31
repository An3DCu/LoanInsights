// Helpers the calculator pages share: read a field, show and clear errors.
import { LoanInputError } from '../finance.js';
import { parseAmount } from '../format.js';

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

// Binds a form once, on document, so the handler keeps working every time the router
// swaps the page in again (event delegation). On submit it runs the calculation and
// hands the result to render. Any error goes to showError instead, and the old result
// is hidden so nobody reads stale numbers.
export function handleSubmit(formSelector, resultsSelector, calculate, render) {
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
  });
}
