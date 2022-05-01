import { NamedPage } from 'vj/misc/Page';
import getAvailableLangs from 'vj/utils/availableLangs';

function setOptions($el, options) {
  $el.empty();
  $.each(options, (key, value) => {
    $el.append($('<option></option>').attr('value', key).text(value));
  });
}

const page = new NamedPage(['problem_submit', 'contest_detail_problem_submit', 'homework_detail_problem_submit'], async () => {
  const { config } = UiContext.pdoc;
  const availableLangs = getAvailableLangs(config.langs);

  function onChangeMain(update = true) {
    const options = {};
    for (const key in availableLangs) {
      if (key.startsWith(`${this.value}.`) && key !== this.value) options[key] = availableLangs[key].display;
    }
    setOptions($('#codelang-sub-select'), options);
    if (Object.keys(options).length) {
      $('#codelang-sub-container').show();
      if (update) $('[name="lang"]').val($('#codelang-sub-select').val());
    } else {
      $('#codelang-sub-container').hide();
      if (update) $('[name="lang"]').val(this.value);
    }
    return Object.keys(options)[0];
  }
  const main = {};
  for (const key in availableLangs) {
    if (config.langs && !config.langs.filter((i) => i === key || i.startsWith(`${key}.`)).length) continue;
    if (!key.includes('.')) main[key] = window.LANGS[key].display;
    else {
      const a = key.split('.')[0];
      main[a] = window.LANGS[a].display;
    }
  }
  setOptions($('#codelang-main-select'), main);

  let isFallback = false;
  const current = $('[name="lang"]').val();
  if (current.includes('.')) {
    const [m] = current.split('.');
    if (main[m]) {
      $('#codelang-main-select').val(m);
      const fallback = onChangeMain.call({ value: m }, false);
      $('#codelang-sub-select').val(current);
      if (fallback && !$('#codelang-sub-select').val()) {
        $('#codelang-sub-select').val(fallback);
        $('[name="lang"]').val(fallback);
      }
    } else isFallback = true;
  } else if (main[current]) {
    $('#codelang-main-select').val(current);
    onChangeMain.call({ value: $('#codelang-main-select').val() }, false);
  } else isFallback = true;

  if (isFallback) {
    $('#codelang-main-select').val(Object.keys(main)[0]);
    onChangeMain.call({ value: Object.keys(main)[0] }, true);
  }

  $('#codelang-main-select').on('change', onChangeMain);
  $('#codelang-sub-select').on('change', function () {
    $('[name="lang"]').val(this.value);
  });
  if (Object.keys(main).length === 1) $('#codelang-main-container').hide();
});

export default page;
