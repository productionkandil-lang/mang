/* ============================================================
   db.js — طبقة تخزين بسيطة فوق Firestore
   بتحاكي localStorage.getItem/setItem بس بتخزن على سيرفرات جوجل
   بدل متصفح المستخدم، وبتحترم قواعد الحماية (firestore.rules)
   ============================================================ */

async function dbGetJSON(key, fallback){
  try{
    const snap = await firebase.firestore().collection('kv_store').doc(key).get();
    if(!snap.exists) return fallback;
    const data = snap.data();
    return (data && data.value !== undefined) ? JSON.parse(data.value) : fallback;
  }catch(err){
    console.error('dbGetJSON failed for', key, err);
    if(err.code === 'permission-denied') return fallback; // مش من حقه يشوفها، سيبها فاضية بهدوء
    return fallback;
  }
}

async function dbSetJSON(key, value){
  try{
    await firebase.firestore().collection('kv_store').doc(key).set({
      value: JSON.stringify(value),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }catch(err){
    console.error('dbSetJSON failed for', key, err);
    alert('حصل خطأ في حفظ البيانات — اتأكد إنك متصل بالإنترنت، أو إنك عندك صلاحية تعديل هنا');
    return false;
  }
}

window.DB = { dbGetJSON, dbSetJSON };
