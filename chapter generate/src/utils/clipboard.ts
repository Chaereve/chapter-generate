/**
 * Sao chép vào clipboard với fallback cho môi trường không có
 * navigator.clipboard (http, iframe, trình duyệt cũ).
 * Trả về true nếu thành công.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // Cách 1: Async Clipboard API (chỉ hoạt động ở secure context)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallthrough sang cách 2
    }
  }

  // Cách 2: textarea tạm + execCommand('copy')
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-999px';
    ta.style.left = '-999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // cho mobile Safari
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
