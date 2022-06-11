import _ from 'lodash';
import $ from 'jquery';
import { NamedPage } from 'vj/misc/Page';
import Notification from 'vj/components/notification';
import { ActionDialog, ConfirmDialog } from 'vj/components/dialog';
import Dropdown from 'vj/components/dropdown/Dropdown';
import createHint from 'vj/components/hint';
import { downloadProblemSet } from 'vj/components/zipDownloader';
import pjax from 'vj/utils/pjax';
import request from 'vj/utils/request';
import tpl from 'vj/utils/tpl';
import delay from 'vj/utils/delay';
import i18n from 'vj/utils/i18n';

const categories = {};
const dirtyCategories = [];
const selections = [];
const list = [];

function setDomSelected($dom, selected) {
  if (selected) $dom.addClass('selected');
  else $dom.removeClass('selected');
}

async function updateSelection(sendRequest = true) {
  dirtyCategories.forEach(({ type, category, subcategory }) => {
    let item = categories[category];
    const isSelected = item.select || _.some(item.children, (c) => c.select);
    setDomSelected(item.$tag, isSelected);
    if (isSelected) {
      selections.push(category);
    } else {
      _.pull(selections, category);
    }
    if (type === 'subcategory') {
      item = categories[category].children[subcategory];
      setDomSelected(item.$tag, item.select);
      const selectionName = subcategory;
      if (item.select) {
        selections.push(selectionName);
      } else {
        _.pull(selections, selectionName);
      }
    }
  });
  dirtyCategories.length = 0;
  if (sendRequest) {
    // a list of categories which subcategory is selected
    const requestCategoryTags = _.uniq(selections
      .filter((s) => s.indexOf(',') !== -1)
      .map((s) => s.split(',')[0]));
    // drop the category if its subcategory is selected
    const requestTags = _.uniq(_.pullAll(selections, requestCategoryTags));
    let q = $('[name="q"]').val().split(' ').filter((i) => !i.startsWith('category:')).join(' ');
    if (requestTags.length) q = requestTags.map((i) => `category:${i}`).join(' ') + (q ? ` ${q}` : '');
    const url = new URL(window.location.href);
    if (!q) url.searchParams.delete('q');
    else url.searchParams.set('q', q);
    url.searchParams.delete('page');
    pjax.request({ url: url.toString() });
    $('[name="q"]').val(q);
  }
}

function buildCategoryFilter() {
  const $container = $('[data-widget-cf-container]');
  if (!$container) return;
  $container.attr('class', 'widget--category-filter row small-up-3 medium-up-2');
  $container.children('li').get().forEach((category) => {
    const $category = $(category)
      .attr('class', 'widget--category-filter__category column');
    const $categoryTag = $category
      .find('.section__title a')
      .remove()
      .attr('class', 'widget--category-filter__category-tag');
    const categoryText = $categoryTag.text();
    const $drop = $category
      .children('.chip-list')
      .remove()
      .attr('class', 'widget--category-filter__drop');
    const treeItem = {
      select: false,
      $tag: $categoryTag,
      children: {},
    };
    categories[categoryText] = treeItem;
    $category.empty().append($categoryTag);
    if ($drop.length > 0) {
      $categoryTag.text(`${$categoryTag.text()}`);
      const $subCategoryTags = $drop
        .children('li')
        .attr('class', 'widget--category-filter__subcategory')
        .find('a')
        .attr('class', 'widget--category-filter__subcategory-tag')
        .attr('data-category', categoryText);
      $subCategoryTags.get().forEach((subCategoryTag) => {
        const $tag = $(subCategoryTag);
        treeItem.children[$tag.text()] = {
          select: false,
          $tag,
        };
      });
      Dropdown.getOrConstruct($categoryTag, {
        target: $drop[0],
        position: 'left center',
      });
    }
  });
  list.push(...Object.keys(categories));
  list.push(..._.flatMap(Object.values(categories), (c) => Object.keys(c.children)));
  $(document).on('click', '.widget--category-filter__category-tag', (ev) => {
    if (ev.shiftKey || ev.metaKey || ev.ctrlKey) return;
    const category = $(ev.currentTarget).text();
    const treeItem = categories[category];
    // the effect should be cancelSelect if it is shown as selected when clicking
    const shouldSelect = treeItem.$tag.hasClass('selected') ? false : !treeItem.select;
    treeItem.select = shouldSelect;
    dirtyCategories.push({ type: 'category', category });
    if (!shouldSelect) {
      // de-select children
      _.forEach(treeItem.children, (treeSubItem, subcategory) => {
        if (treeSubItem.select) {
          treeSubItem.select = false;
          dirtyCategories.push({ type: 'subcategory', subcategory, category });
        }
      });
    }
    updateSelection();
    ev.preventDefault();
  });
  $(document).on('click', '.widget--category-filter__subcategory-tag', (ev) => {
    if (ev.shiftKey || ev.metaKey || ev.ctrlKey) return;
    const subcategory = $(ev.currentTarget).text();
    const category = $(ev.currentTarget).attr('data-category');
    const treeItem = categories[category].children[subcategory];
    treeItem.select = !treeItem.select;
    dirtyCategories.push({ type: 'subcategory', subcategory, category });
    updateSelection();
    ev.preventDefault();
  });
}

function parseCategorySelection() {
  UiContext.currentCategory.split(' ').forEach((cline) => {
    const [category, subcategory] = cline.split(',');
    if (!categories[category]) return;
    if (subcategory && !categories[category].children[subcategory]) return;
    if (!subcategory) {
      categories[category].select = true;
      dirtyCategories.push({ type: 'category', category });
    } else {
      categories[category].children[subcategory].select = true;
      dirtyCategories.push({ type: 'subcategory', subcategory, category });
    }
  });
  updateSelection(false);
}

function ensureAndGetSelectedPids() {
  const pids = _.map(
    $('tbody [data-checkbox-group="problem"]:checked'),
    (ch) => $(ch).closest('tr').attr('data-pid'),
  );
  if (pids.length === 0) {
    Notification.error(i18n('Please select at least one problem to perform this operation.'));
    return null;
  }
  return pids;
}

async function handleOperation(operation) {
  const pids = ensureAndGetSelectedPids();
  if (pids === null) return;
  const payload = {};
  if (operation === 'delete') {
    const action = await new ConfirmDialog({
      $body: tpl.typoMsg(i18n('Confirm to delete the selected problems?')),
    }).open();
    if (action !== 'yes') return;
  } else if (operation === 'copy') {
    const action = await new ActionDialog({
      $body: tpl`
        <div class="typo">
          <label>
            ${i18n('Target')}
            <div class="textbox-container">
              <input name="target" type="text" class="textbox" data-autofocus>
            </div>
          </label>
        </div>
      `,
    }).open();
    if (action !== 'ok') return;
    const target = $('[name="target"]').val();
    if (!target) return;
    payload.target = target;
  }
  try {
    await request.post('', { operation, pids, ...payload });
    Notification.success(i18n(`Selected problems have been ${operation === 'copy' ? 'copie' : operation}d.`));
    await delay(2000);
    updateSelection(true);
  } catch (error) {
    Notification.error(error.message);
  }
}

function hideTags(target) {
  $(target).find('.problem__tag').get()
    .filter((i) => list.includes(i.children[0].innerHTML))
    .forEach((i) => $(i).addClass('notag--hide'));
}

async function handleDownload(ev) {
  let name = 'Export';
  // eslint-disable-next-line no-alert
  if (ev.shiftKey) name = prompt('Filename:', name);
  const pids = ensureAndGetSelectedPids();
  if (pids) await downloadProblemSet(pids, name);
}

function processElement(ele) {
  hideTags(ele);
  createHint('Hint::icon::difficulty', $(ele).find('th.col--difficulty'));
}

const page = new NamedPage(['problem_main'], () => {
  const doc = document.body;
  doc.className += ' display-mode';
  $('.section.display-mode').removeClass('display-mode');
  buildCategoryFilter();
  parseCategorySelection();
  $(document).on('click', '[name="leave-edit-mode"]', () => {
    doc.className = doc.className.replace(' edit-mode', ' display-mode');
  });
  $(document).on('click', '[name="enter-edit-mode"]', () => {
    doc.className = doc.className.replace(' display-mode', ' edit-mode');
  });
  ['delete', 'hide', 'unhide', 'copy'].forEach((op) => {
    $(document).on('click', `[name="${op}_selected_problems"]`, () => handleOperation(op));
  });
  $(document).on('click', '[name="download_selected_problems"]', handleDownload);

  $(document).on('click', '.toggle-tag', () => {
    $('.section__table-container').children(1).toggleClass('hide-problem-tag');
  });
  $('#search').on('click', (ev) => {
    ev.preventDefault();
    updateSelection();
  });
  $('#searchForm').on('submit', updateSelection);
  let update;
  $('#searchForm').find('input').on('input', () => {
    if (update) clearTimeout(update);
    update = setTimeout(updateSelection, 500);
  });
  $(document).on('click', 'a.pager__item', (ev) => {
    ev.preventDefault();
    pjax.request(ev.currentTarget.getAttribute('href')).then(() => window.scrollTo(0, 0));
  });
  $(document).on('vjContentNew', (e) => processElement(e.target));
  processElement(document);
});

export default page;
