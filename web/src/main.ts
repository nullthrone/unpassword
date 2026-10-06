import './styles.css';
import { lang } from './i18n';
import { App } from './ui/app';

document.documentElement.lang = lang;
const root = document.getElementById('app')!;
void new App(root).start();
