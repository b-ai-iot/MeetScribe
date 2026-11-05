// Original functional icons. Labels live in text spans, so live translations preserve the SVG.
const paths={
 library:'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6l1.5 1.5 M16.9 16.9l1.5 1.5 M5.6 18.4l1.5-1.5 M16.9 7.1l1.5-1.5',
 shield:'M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6z M8.5 12l2.5 2.5 4.5-5',
 refresh:'M20 10a8 8 0 1 0-2 8 M20 4v6h-6',
 download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
 edit:'m15 4 5 5 M4 20l5-1 12-12-5-5L4 14z',
 trash:'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
 folder:'M3 6h7l2 3h9v11H3z',
 save:'M4 3h13l3 3v15H4z M8 3v6h8V3 M8 21v-8h8v8',
 reset:'M4 9a8 8 0 1 1 0 6 M4 3v6h6',
 stop:'M6 6h12v12H6z',
 close:'M6 6l12 12 M18 6 6 18',
 appearance:'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-4-5-6-9-6 M7 9h.01 M10 6h.01 M16 7h.01',
 language:'M3 5h12 M9 3v2 M5 5c0 6 5 10 9 12 M13 5c0 6-5 10-9 12 M14 21l4-10 4 10 M16 17h4'
};
export function createIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('ui-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.folder);svg.append(path);return svg;}
export function decorateIcons(root=document){for(const node of root.querySelectorAll('[data-icon]')){if(!node.querySelector('.ui-icon'))node.prepend(createIcon(node.dataset.icon));}}
