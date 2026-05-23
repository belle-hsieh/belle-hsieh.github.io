const ASCII_ART_PATH = 'ascii-art.txt';
let asciiArtCache = null;
let asciiArtPromise = null;

const loadAsciiArt = () => {
  if (asciiArtCache) {
    return Promise.resolve(asciiArtCache);
  }
  if (asciiArtPromise) {
    return asciiArtPromise;
  }

  asciiArtPromise = fetch(ASCII_ART_PATH)
    .then((response) => {
      if (!response.ok) {
        throw new Error('ascii-art-load-failed');
      }
      return response.text();
    })
    .then((text) => {
      asciiArtCache = text;
      return asciiArtCache;
    })
    .catch(() => {
      asciiArtCache = 'ASCII art unavailable.';
      return asciiArtCache;
    });

  return asciiArtPromise;
};

const editors = document.querySelectorAll('.editor');
const STORAGE_KEY = 'openTabs';
const ACTIVE_KEY = 'activeTab';
const DEFAULT_TABS = [
  { href: 'index.html', label: 'about.md' },
  { href: 'projects.html', label: 'projects.py' },
  { href: 'publications.html', label: 'publications.md' }
];

const updateEditorState = (editor) => {
  const tabs = editor.querySelectorAll('.tabs .tab');
  editor.classList.toggle('is-empty', tabs.length === 0);
};

const setActiveTab = (tabsContainer, activeTab) => {
  tabsContainer.querySelectorAll('.tab').forEach((tab) => {
    const isActive = tab === activeTab;
    tab.classList.toggle('active', isActive);
    if (isActive) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  });
};

const setAsciiArt = (editor) => {
  const empty = editor.querySelector('.editor-empty');
  if (!empty) {
    return;
  }

  let pre = empty.querySelector('pre');
  if (!pre) {
    pre = document.createElement('pre');
    pre.className = 'ascii-art';
    empty.innerHTML = '';
    empty.appendChild(pre);
  }

  loadAsciiArt().then((art) => {
    pre.textContent = art;
  });
};

const canUseStorage = () => typeof window !== 'undefined' && 'sessionStorage' in window;

const getStoredTabs = () => {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

const getStoredActive = () => {
  if (!canUseStorage()) {
    return null;
  }

  return window.sessionStorage.getItem(ACTIVE_KEY);
};

const storeTabsState = (tabs, activeHref) => {
  if (!canUseStorage()) {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  if (activeHref) {
    window.sessionStorage.setItem(ACTIVE_KEY, activeHref);
  } else {
    window.sessionStorage.removeItem(ACTIVE_KEY);
  }
};

const collectTabsFromDom = (tabsContainer) =>
  Array.from(tabsContainer.querySelectorAll('.tab'))
    .map((tab) => {
      const link = tab.querySelector('a');
      if (!link) {
        return null;
      }

      const href = link.getAttribute('href') || '';
      const label = link.textContent?.trim() || 'file';
      return { href, label };
    })
    .filter(Boolean);

const createTabElement = (href, label, isActive) => {
  const tab = document.createElement('div');
  tab.className = 'tab';
  if (isActive) {
    tab.classList.add('active');
    tab.setAttribute('aria-current', 'page');
  }

  const link = document.createElement('a');
  link.href = href || '#';
  link.textContent = label;

  const closeButton = document.createElement('button');
  closeButton.className = 'tab-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', `Close ${label} tab`);
  closeButton.textContent = 'x';
  attachCloseHandler(closeButton);

  tab.appendChild(link);
  tab.appendChild(closeButton);
  return tab;
};

const buildTabs = (tabsContainer, tabs, activeHref) => {
  tabsContainer.innerHTML = '';
  tabs.forEach((tabData) => {
    if (!tabData || !tabData.href) {
      return;
    }

    const isActive = tabData.href === activeHref;
    const tab = createTabElement(tabData.href, tabData.label || 'file', isActive);
    tabsContainer.appendChild(tab);
  });

  const firstTab = tabsContainer.querySelector('.tab');
  const activeTab = tabsContainer.querySelector('.tab.active');
  if (!activeTab && firstTab) {
    setActiveTab(tabsContainer, firstTab);
  }
};

const getNormalizedPath = (href) => {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, window.location.href).pathname;
  } catch (error) {
    return href;
  }
};

const getDefaultActiveHref = () => {
  const currentPath = getNormalizedPath(window.location.href);
  const normalizedCurrent = currentPath.endsWith('/') ? `${currentPath}index.html` : currentPath;

  const match = DEFAULT_TABS.find((tab) => {
    const tabPath = getNormalizedPath(tab.href);
    return normalizedCurrent.endsWith(`/${tabPath}`) || normalizedCurrent.endsWith(tabPath);
  });

  return match ? match.href : DEFAULT_TABS[0].href;
};

const removeTab = (tab) => {
  if (!tab) {
    return;
  }

  if (typeof tab.remove === 'function') {
    tab.remove();
    return;
  }

  tab.parentNode?.removeChild(tab);
};

const handleTabClose = (event, button) => {
  event.preventDefault();
  event.stopPropagation();
  const tab = button.closest('.tab');
  if (!tab) {
    return;
  }

  const tabsContainer = tab.parentElement;
  const editor = tab.closest('.editor');
  const isActive = tab.classList.contains('active');
  const nextTab = tab.nextElementSibling || tab.previousElementSibling;
  removeTab(tab);

  if (editor) {
    updateEditorState(editor);
  }

  if (!tabsContainer || !isActive) {
    return;
  }

  if (nextTab) {
    setActiveTab(tabsContainer, nextTab);
  }

  if (tabsContainer) {
    const activeHref = tabsContainer.querySelector('.tab.active a')?.getAttribute('href') || '';
    storeTabsState(collectTabsFromDom(tabsContainer), activeHref);
  }
};

const attachCloseHandler = (button) => {
  if (button.dataset.bound === 'true') {
    return;
  }

  button.addEventListener('click', (event) => handleTabClose(event, button));
  button.dataset.bound = 'true';
};

const restoreTabs = (editor) => {
  const tabsContainer = editor.querySelector('.tabs');
  if (!tabsContainer) {
    return;
  }

  const storedTabs = getStoredTabs();
  const activeHref = getStoredActive();

  if (!storedTabs || storedTabs.length === 0) {
    const defaultActiveHref = getDefaultActiveHref();
    buildTabs(tabsContainer, DEFAULT_TABS, defaultActiveHref);
    storeTabsState(DEFAULT_TABS, defaultActiveHref);
    return;
  }

  buildTabs(tabsContainer, storedTabs, activeHref);
};

const openTabFromLink = (editor, href, label) => {
  const tabsContainer = editor.querySelector('.tabs');
  if (!tabsContainer) {
    return;
  }

  const existingLink = tabsContainer.querySelector(`.tab a[href="${href}"]`);
  if (existingLink) {
    setActiveTab(tabsContainer, existingLink.closest('.tab'));
  } else {
    const tab = createTabElement(href, label, true);
    tabsContainer.appendChild(tab);
    setActiveTab(tabsContainer, tab);
  }

  updateEditorState(editor);
  const activeHref = tabsContainer.querySelector('.tab.active a')?.getAttribute('href') || '';
  storeTabsState(collectTabsFromDom(tabsContainer), activeHref);
};

editors.forEach((editor) => {
  setAsciiArt(editor);
  restoreTabs(editor);
  updateEditorState(editor);
});

document.addEventListener('click', (event) => {
  const targetNode = event.target;
  const target = targetNode instanceof Element ? targetNode : targetNode?.parentElement;
  if (!target) {
    return;
  }

  const fileLink = target.closest('.file-tree a');
  if (fileLink) {
    event.preventDefault();
    const editor = fileLink.closest('.workspace')?.querySelector('.editor');
    if (!editor) {
      return;
    }

    const targetHref = fileLink.getAttribute('href') || '';
    const label = fileLink.textContent?.trim() || 'file';
    openTabFromLink(editor, targetHref, label);

    const targetPath = getNormalizedPath(targetHref);
    const currentPath = getNormalizedPath(window.location.href);
    if (targetPath && targetPath !== currentPath) {
      window.location.href = targetHref;
    }
    return;
  }

  const tabLink = target.closest('.tabs .tab a');
  if (!tabLink) {
    return;
  }

  event.preventDefault();
  const editor = tabLink.closest('.editor');
  if (!editor) {
    return;
  }

  const tabsContainer = editor.querySelector('.tabs');
  if (!tabsContainer) {
    return;
  }

  const tab = tabLink.closest('.tab');
  if (tab) {
    setActiveTab(tabsContainer, tab);
  }

  const href = tabLink.getAttribute('href') || '';
  storeTabsState(collectTabsFromDom(tabsContainer), href);
  const targetPath = getNormalizedPath(href);
  const currentPath = getNormalizedPath(window.location.href);
  if (targetPath && targetPath !== currentPath) {
    window.location.href = href;
  }
});
