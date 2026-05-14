export interface DeviceCapabilities {
  isTouchCapable: boolean;
  isTablet: boolean;
  isMobile: boolean;
  hasStylusSupport: boolean;
  platform: 'ios' | 'android' | 'windows-touch' | 'desktop' | 'unknown';
}

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      isTouchCapable: false, isTablet: false,
      isMobile: false, hasStylusSupport: false, platform: 'unknown',
    };
  }

  const ua = navigator.userAgent;
  const maxTouch = navigator.maxTouchPoints ?? 0;

  const isTouchCapable = maxTouch > 0 || 'ontouchstart' in window;

  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && maxTouch > 1);

  const isAndroid = /Android/.test(ua);

  const isWindowsTouch = /Windows/.test(ua) && maxTouch > 0;

  const screenMin = Math.min(window.screen.width, window.screen.height);
  const isTablet = isTouchCapable && (
    isIOS ||
    (isAndroid && screenMin >= 600) ||
    isWindowsTouch
  );

  const isMobile = isTouchCapable && !isTablet && (isIOS || isAndroid);

  const platform: DeviceCapabilities['platform'] =
    isIOS ? 'ios' :
    isAndroid ? 'android' :
    isWindowsTouch ? 'windows-touch' :
    isTouchCapable ? 'unknown' : 'desktop';

  const hasStylusSupport = isTablet;

  return { isTouchCapable, isTablet, isMobile, hasStylusSupport, platform };
}

let _capabilities: DeviceCapabilities | null = null;
export function getDeviceCapabilities(): DeviceCapabilities {
  if (!_capabilities) _capabilities = detectDeviceCapabilities();
  return _capabilities;
}

export function markStylusSeen(): void {
  if (_capabilities) _capabilities.hasStylusSupport = true;
}
