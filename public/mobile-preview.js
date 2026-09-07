const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const params = new URLSearchParams(window.location.search);

if (localHosts.has(window.location.hostname) && !params.has('mobilePreview')) {
  const style = document.createElement('style');
  style.textContent = `
    .mobile-preview-launcher{position:fixed;right:18px;bottom:18px;z-index:9998;border:0;border-radius:999px;padding:12px 17px;background:#235347;color:#fff;font:700 13px/1 "Malgun Gothic",sans-serif;box-shadow:0 8px 25px #0003;cursor:pointer}
    .mobile-preview-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#17241fdd;padding:16px}
    .mobile-preview-dialog{display:flex;flex-direction:column;max-width:100%;max-height:100%;border-radius:28px;background:#202421;box-shadow:0 24px 80px #0008;overflow:hidden}
    .mobile-preview-toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;color:#fff;font:600 12px/1 "Malgun Gothic",sans-serif}
    .mobile-preview-close{border:0;border-radius:999px;background:#ffffff1c;color:#fff;padding:7px 11px;cursor:pointer}
    .mobile-preview-frame{width:390px;height:min(844px,calc(100vh - 80px));max-width:calc(100vw - 32px);border:0;background:#fff}
  `;
  document.head.append(style);

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'mobile-preview-launcher';
  launcher.textContent = '모바일 화면';
  launcher.setAttribute('aria-haspopup', 'dialog');
  document.body.append(launcher);

  launcher.addEventListener('click', () => {
    const previewUrl = new URL(window.location.href);
    previewUrl.searchParams.set('mobilePreview', '1');

    const overlay = document.createElement('div');
    overlay.className = 'mobile-preview-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '모바일 화면 미리보기');
    overlay.innerHTML = `<div class="mobile-preview-dialog"><div class="mobile-preview-toolbar"><span>390 × 844</span><button type="button" class="mobile-preview-close" aria-label="미리보기 닫기">닫기</button></div><iframe class="mobile-preview-frame" title="모바일 화면" src="${previewUrl.href}"></iframe></div>`;
    document.body.append(overlay);

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      launcher.focus();
    };
    function onKeydown(event) { if (event.key === 'Escape') close(); }
    overlay.querySelector('.mobile-preview-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', onKeydown);
    overlay.querySelector('.mobile-preview-close').focus();
  });
}
