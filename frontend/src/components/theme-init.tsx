import { THEME_STORAGE_KEY } from '@/lib/theme';

const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
