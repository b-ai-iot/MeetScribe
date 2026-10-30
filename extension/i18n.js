// Shared by classic content scripts and module contexts. All catalogs are local assets.
(() => {
  if (globalThis.__meetScribeI18n) return;
  const catalogs = {vi:Object.create(null), en:Object.create(null)};
  let language = 'vi';
  let templates = [];
  const normalizeLanguage = value => value === 'en' ? 'en' : 'vi';
  const setLanguage = value => (language = normalizeLanguage(value));
  const getLanguage = () => language;
  const getLocale = (value = language) => normalizeLanguage(value) === 'en' ? 'en-US' : 'vi-VN';
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function registerMessages(messages) {
    for (const lang of ['vi','en']) {
      for (const [key,value] of Object.entries(messages[lang] || {})) {
        if (typeof value !== 'string') throw new TypeError(`Invalid translation: ${key}`);
        if (catalogs[lang][key] !== undefined && catalogs[lang][key] !== value) {
          throw new Error(`Conflicting translation: ${key}`);
        }
        catalogs[lang][key] = value;
      }
    }
    templates = [];
    for (const lang of ['vi','en']) {
      for (const [key,value] of Object.entries(catalogs[lang])) {
        const names = [];
        let pattern = '', offset = 0, literalSize = 0;
        for (const match of value.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
          const literal = value.slice(offset,match.index);
          literalSize += literal.length;
          pattern += escapeRegex(literal) + '([\\s\\S]*?)';
          names.push(match[1]);
          offset = match.index + match[0].length;
        }
        literalSize += value.length - offset;
        pattern += escapeRegex(value.slice(offset));
        if (literalSize >= 3) templates.push({key,names,literalSize,regex:new RegExp('^'+pattern+'$')});
      }
    }
    templates.sort((a,b)=>b.literalSize-a.literalSize);
  }

  function t(key,params = {},lang = language) {
    const template = catalogs[normalizeLanguage(lang)][key] ?? catalogs.vi[key] ?? String(key);
    return template.replace(/\{([A-Za-z0-9_]+)\}/g,(original,name)=>
      Object.prototype.hasOwnProperty.call(params,name) ? String(params[name]) : original);
  }

  // Only this wrapper's detail is itself an application error. Other parameters
  // (including paths and folder names) must remain literal user/native data.
  function displayMessage(key,params,lang) {
    if (key === 'system.visualUnavailable' && typeof params.detail === 'string') {
      return t(key,{...params,detail:translateMessage(params.detail,lang)},lang);
    }
    return t(key,params,lang);
  }

  // Use ONLY at an explicit application error/notice boundary, never on captured/user text.
  function translateMessage(value,lang = language) {
    const text = String(value ?? '');
    for (const template of templates) {
      const match = template.regex.exec(text);
      if (!match) continue;
      const params = Object.create(null);
      template.names.forEach((name,index)=>{params[name]=match[index+1];});
      return displayMessage(template.key,params,lang);
    }
    return text;
  }

  function errorMessage(error,lang = language) {
    if (error && typeof error === 'object') {
      const code = error.errorCode ?? error.code;
      if (code && (catalogs.vi[code] !== undefined || catalogs.en[code] !== undefined)) {
        return displayMessage(code,error.errorParams ?? error.params ?? {},lang);
      }
      return translateMessage(error.error ?? error.message ?? String(error),lang);
    }
    return translateMessage(error,lang);
  }

  function messageError(key,params = {}) {
    const error = new Error(t(key,params));
    error.code = key;
    error.params = {...params};
    return error;
  }

  function applyTranslations(root = globalThis.document) {
    if (!root?.querySelectorAll) return;
    const nodes = [...root.querySelectorAll('[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder]')];
    if (root.matches?.('[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder]')) nodes.unshift(root);
    for (const node of nodes) {
      if (node.hasAttribute('data-i18n')) node.textContent = t(node.getAttribute('data-i18n'));
      for (const attr of ['title','aria-label','placeholder']) {
        if (node.hasAttribute('data-i18n-'+attr)) node.setAttribute(attr,t(node.getAttribute('data-i18n-'+attr)));
      }
    }
  }

  const getMessages = () => ({vi:{...catalogs.vi},en:{...catalogs.en}});
  globalThis.__meetScribeI18n = {normalizeLanguage,setLanguage,getLanguage,getLocale,
    registerMessages,t,translateMessage,errorMessage,messageError,applyTranslations,getMessages};
})();
