/* ============================================================
   auth.js — دخول حقيقي عبر Firebase Authentication + صلاحيات
   محفوظة في Firestore (مش قابلة للتخطي من المتصفح)
   ============================================================ */
(function(){

const ROLE_LABELS = {
  admin:      'مدير النظام',
  finance:    'مطّلع على الفلوس',
  data_entry: 'مدخل بيانات'
};

const PAGE_PERMS = {
  index:      { admin:'edit', finance:'view', data_entry:'view' },
  employees:  { admin:'edit', finance:'view', data_entry:'edit' },
  systems:    { admin:'edit', finance:'view', data_entry:'edit' },
  upload:     { admin:'edit', finance:'none', data_entry:'edit' },
  records:    { admin:'edit', finance:'none', data_entry:'edit' },
  advances:   { admin:'edit', finance:'edit', data_entry:'none' },
  holidays:   { admin:'edit', finance:'none', data_entry:'edit' },
  schedule:   { admin:'edit', finance:'none', data_entry:'edit' },
  van:        { admin:'edit', finance:'view', data_entry:'edit' },
  closing:    { admin:'edit', finance:'view', data_entry:'none' },
  history:    { admin:'edit', finance:'view', data_entry:'none' },
  users:      { admin:'edit', finance:'none', data_entry:'none' },
  import:     { admin:'edit', finance:'none', data_entry:'none' }
};

function pageKeyFromLocation(){
  const file = location.pathname.split('/').pop() || 'index.html';
  return file.replace('.html','') || 'index';
}

let currentSession = null;

function getSession(){ return currentSession; }

function getPermission(pageKey){
  if(!currentSession) return 'none';
  const perms = PAGE_PERMS[pageKey];
  if(!perms) return 'edit';
  return perms[currentSession.role] || 'none';
}

async function login(email, password){
  await firebase.auth().signInWithEmailAndPassword(email, password);
}

function logout(){
  firebase.auth().signOut().then(()=> location.href = 'login.html');
}

function showOverlay(msg){
  let ov = document.getElementById('authLoadingOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'authLoadingOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:#12181c;color:#8fa0a8;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-family:Tajawal,Arial,sans-serif;font-size:14px;z-index:99999;';
    document.documentElement.appendChild(ov);
  }
  ov.textContent = msg || 'جاري التحقق من الدخول...';
}
function hideOverlay(){
  const ov = document.getElementById('authLoadingOverlay');
  if(ov) ov.remove();
}

function injectStyle(){
  if(document.getElementById('authInjectedStyle')) return;
  const style = document.createElement('style');
  style.id = 'authInjectedStyle';
  style.textContent = `
    .hide-money .money-col{ display:none !important; }
    #authUserBadge{ font-size:12px !important; }
    .auth-blocked-input{ opacity:.55 !important; cursor:not-allowed !important; }
  `;
  document.head.appendChild(style);
}

function guardPage(pageKey){
  injectStyle();
  showOverlay();
  return new Promise((resolve)=>{
    firebase.auth().onAuthStateChanged(async function(user){
      if(!user){
        location.replace('login.html');
        return;
      }
      let profile = null;
      try{
        const snap = await firebase.firestore().collection('users').doc(user.uid).get();
        profile = snap.exists ? snap.data() : null;
      }catch(err){
        console.error('تعذر تحميل بيانات الصلاحيات', err);
      }
      if(!profile){
        showOverlay('حسابك مش مربوط بأي صلاحيات — كلم مدير النظام');
        return;
      }
      currentSession = { uid:user.uid, email:user.email, role:profile.role, name:profile.name || profile.username || user.email };
      const perm = getPermission(pageKey);
      if(perm === 'none'){
        location.replace('index.html?denied=1');
        return;
      }
      window.__AUTH_PAGE__ = pageKey;
      window.__AUTH_PERM__ = perm;
      hideOverlay();
      resolve({ session: currentSession, perm: perm });
    });
  });
}

function finalizeAuthUI(){
  const session = currentSession;
  const pageKey = window.__AUTH_PAGE__ || pageKeyFromLocation();
  const perm = window.__AUTH_PERM__ || getPermission(pageKey);
  if(!session) return;

  document.querySelectorAll('header nav a[href]').forEach(a=>{
    const key = a.getAttribute('href').split('?')[0].replace('.html','');
    if(getPermission(key) === 'none') a.style.display = 'none';
  });

  const nav = document.querySelector('header nav');
  if(nav && !document.getElementById('authUserBadge')){
    if(session.role === 'admin' && !nav.querySelector('a[href="users.html"]')){
      const usersLink = document.createElement('a');
      usersLink.href = 'users.html';
      usersLink.textContent = 'المستخدمين';
      nav.appendChild(usersLink);
    }
    if(session.role === 'admin' && !nav.querySelector('a[href="import.html"]')){
      const importLink = document.createElement('a');
      importLink.href = 'import.html';
      importLink.textContent = 'استيراد نسخة قديمة';
      nav.appendChild(importLink);
    }
    const badge = document.createElement('a');
    badge.href = '#';
    badge.id = 'authUserBadge';
    badge.style.marginInlineStart = '14px';
    badge.style.color = 'var(--brass-bright)';
    badge.title = 'تسجيل الخروج';
    badge.textContent = '👤 ' + session.name + ' (' + (ROLE_LABELS[session.role]||session.role) + ') — خروج';
    badge.onclick = function(e){ e.preventDefault(); if(confirm('تسجيل الخروج؟')) logout(); };
    nav.appendChild(badge);
  }

  if(perm === 'view'){
    document.body.classList.add('auth-view-only');
    document.querySelectorAll('input, select, textarea, button').forEach(el=>{
      if(el.id === 'authUserBadge' || el.closest('#authUserBadge')) return;
      if(el.dataset.authSafe === '1') return;
      el.disabled = true;
      el.classList.add('auth-blocked-input');
    });
  }

  if(pageKey === 'employees' && session.role === 'data_entry'){
    const table = document.getElementById('empTable');
    if(table) table.classList.add('hide-money');
  }

  if(location.search.includes('denied=1')){
    setTimeout(function(){ alert('معنديش صلاحية تدخل الصفحة اللي طلبتها'); }, 50);
    if(history.replaceState) history.replaceState(null, '', location.pathname);
  }
}

window.Auth = {
  pageKeyFromLocation, guardPage, finalizeAuthUI,
  getSession, login, logout, getPermission, PAGE_PERMS, ROLE_LABELS
};

})();
