import type { DesktopApi } from '../../shared/contracts';
import { createWebDesktopApi } from './web-api';

const scope = window as Window & { ganymede?: DesktopApi };
if (scope.ganymede === undefined) {
  scope.ganymede = createWebDesktopApi();
  document.documentElement.dataset['shell'] = 'opaque';
}
