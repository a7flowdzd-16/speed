import AsyncStorage from '@react-native-async-storage/async-storage';

// 🚀 FAKE SUPABASE CLIENT
// تم بناء هذا العميل المزيف لمنع انهيار باقي الشاشات أثناء انتقالنا إلى MySQL.
// كل الدوال تُعيد قيماً فارغة أو دمي (Dummy) لتفادي أخطاء TypeError و undefined.

const createFakeBuilder = () => {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => ({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null })
  };
  return builder;
};

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: null, error: null }),
    signUp: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: (table: string) => createFakeBuilder(),
  channel: (name: string) => ({
    on: () => ({ subscribe: () => {} }),
    subscribe: () => {},
    unsubscribe: () => {}
  }),
  removeChannel: () => {},
  storage: {
    from: (bucket: string) => ({
      upload: async () => ({ error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: '' } })
    })
  }
};
