'use strict';

/* imzic-modal.js — Modal xác nhận / nhập liệu của I-MZic, thay window.confirm /
 * window.prompt native (hộp trắng hệ điều hành, lệch hoàn toàn với UI tối của
 * trang). DOM tự sinh đúng màu bằng biến CSS của img-to-vid.html (--panel,
 * --border, --accent…), nút tái dùng class .btn / .btn.primary có sẵn.
 * Nạp SAU imzic-core.js, TRƯỚC imzic-presets.js + imzic-workflow.js (2 file
 * này gọi imzModalPrompt / imzModalConfirm khi gắn listener). Không import/
 * export (renderer không build step — AGENTS.md §4/§8). API promise:
 *   imzModalConfirm({title, message, okText, danger}) → Promise<boolean>
 *   imzModalPrompt ({title, message, value, okText})  → Promise<string|null>
 * Esc / click nền / nút Huỷ = từ chối; Enter = OK. Chỉ 1 modal tại một thời
 * điểm — mở modal mới khi đang mở thì modal cũ được đóng ngầm (resolve false).
 */

function imzModalEnsureDom(){
  let ov = document.getElementById('imzModalOverlay');
  if(ov) return ov;
  ov = document.createElement('div');
  ov.id = 'imzModalOverlay';
  ov.className = 'imz-modal-overlay';
  ov.innerHTML =
    '<div class="imz-modal" role="dialog" aria-modal="true">' +
      '<div class="imz-modal-title"></div>' +
      '<div class="imz-modal-msg"></div>' +
      '<input class="imz-modal-input" type="text" autocomplete="off" spellcheck="false">' +
      '<div class="imz-modal-btns">' +
        '<button type="button" class="btn imz-modal-cancel">Huỷ</button>' +
        '<button type="button" class="btn primary imz-modal-ok">OK</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  return ov;
}

// Trạng thái mở hiện tại (resolver + phần tử đang focus trước khi mở)
let imzModalActive = null;

function imzModalClose(result){
  const ov = document.getElementById('imzModalOverlay');
  if(!ov || !imzModalActive) return;
  const act = imzModalActive;
  imzModalActive = null;
  ov.style.display = 'none';
  document.removeEventListener('keydown', act.onKey, true);
  if(act.prevFocus && act.prevFocus.isConnected){
    try{ act.prevFocus.focus(); }catch(e){}
  }
  act.resolve(result);
}

function imzModalOpen(opts, withInput){
  return new Promise(resolve=>{
    // đang mở modal khác → đóng ngầm như Huỷ (không nuốt lỗi, chỉ chặn đè UI)
    if(imzModalActive) imzModalClose(withInput ? null : false);
    const ov = imzModalEnsureDom();
    const titleEl = ov.querySelector('.imz-modal-title');
    const msgEl   = ov.querySelector('.imz-modal-msg');
    const inputEl = ov.querySelector('.imz-modal-input');
    const okEl    = ov.querySelector('.imz-modal-ok');
    const cancelEl= ov.querySelector('.imz-modal-cancel');
    const okBtn   = okEl;

    titleEl.textContent = opts.title || '';
    msgEl.textContent   = opts.message || '';
    msgEl.style.display = opts.message ? '' : 'none';
    okBtn.textContent   = opts.okText || 'OK';
    okBtn.classList.toggle('danger', !!opts.danger);

    if(withInput){
      inputEl.style.display = '';
      inputEl.value = opts.value || '';
    }else{
      inputEl.style.display = 'none';
      inputEl.value = '';
    }

    const onKey = (e)=>{
      if(e.key === 'Escape'){ e.stopPropagation(); imzModalClose(withInput ? null : false); }
      else if(e.key === 'Enter' && document.activeElement !== okBtn){
        // Enter trong ô input / bất kỳ đâu → xác nhận (nút OK tự Enter mặc định)
        e.preventDefault(); imzModalClose(withInput ? inputEl.value : true);
      }
    };

    imzModalActive = { resolve, onKey, prevFocus: document.activeElement };
    document.addEventListener('keydown', onKey, true);

    okBtn.onclick     = ()=> imzModalClose(withInput ? inputEl.value : true);
    cancelEl.onclick  = ()=> imzModalClose(withInput ? null : false);
    ov.onclick = (e)=>{ if(e.target === ov) imzModalClose(withInput ? null : false); };

    ov.style.display = 'flex';
    if(withInput){
      inputEl.focus();
      inputEl.select();
    }else{
      okBtn.focus();
    }
  });
}

function imzModalConfirm(opts){
  return imzModalOpen(opts || {}, false);
}

function imzModalPrompt(opts){
  return imzModalOpen(opts || {}, true);
}
