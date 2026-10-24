import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, RefreshControl,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api, API_URL, loadToken, saveToken, Loan, Summary } from './src/api';

const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const isOverdue = (l: Loan) => !l.repaid_at && l.due_date < todayStr();

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    loadToken().then((t) => { setAuthed(!!t); setReady(true); });
  }, []);

  if (!ready) return <View style={s.center}><ActivityIndicator /></View>;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        {authed ? (
          <Home onLogout={async () => { await saveToken(null); setAuthed(false); }} />
        ) : (
          <Login onDone={() => setAuthed(true)} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { Alert.alert('Error', e.message); }
    setBusy(false);
  };

  return (
    <View style={s.loginBox}>
      <Text style={s.title}>MiniLedger</Text>
      <Text style={s.sub}>Track money you lent to friends</Text>
      <TextInput
        style={s.input} placeholder="Phone number" keyboardType="phone-pad"
        value={phone} onChangeText={setPhone} editable={!sent}
      />
      {sent && (
        <TextInput
          style={s.input} placeholder="6-digit OTP (see server log)" keyboardType="number-pad"
          maxLength={6} value={otp} onChangeText={setOtp}
        />
      )}
      <TouchableOpacity
        style={s.btn} disabled={busy}
        onPress={() => run(async () => {
          if (!sent) { await api.requestOtp(phone.trim()); setSent(true); }
          else {
            const { token } = await api.verifyOtp(phone.trim(), otp.trim());
            await saveToken(token);
            onDone();
          }
        })}
      >
        <Text style={s.btnText}>{busy ? 'Please wait…' : sent ? 'Verify & Login' : 'Send OTP'}</Text>
      </TouchableOpacity>
      {sent && (
        <TouchableOpacity onPress={() => { setSent(false); setOtp(''); }}>
          <Text style={[s.link, { textAlign: 'center', marginTop: 12 }]}>Change number</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Home({ onLogout }: { onLogout: () => void }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [l, sm] = await Promise.all([api.loans(), api.summary()]);
      setLoans(l); setSummary(sm);
    } catch (e: any) {
      if (e.status === 401) onLogout();
      else Alert.alert('Error', e.message);
    }
    setRefreshing(false);
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);

  const repay = (l: Loan) =>
    Alert.alert('Mark as repaid?', `${l.friend_name} paid back ${inr(l.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try { await api.markRepaid(l.id); load(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);

  const header = (
    <View>
      <Text style={s.title}>MiniLedger</Text>
      <View style={s.card}>
        <Text style={s.cardLabel}>Outstanding</Text>
        <Text style={s.cardBig}>{inr(summary?.outstanding ?? 0)}</Text>
        <View style={s.row}>
          <Stat label="Total lent" value={inr(summary?.total_lent ?? 0)} />
          <Stat label="Repaid" value={inr(summary?.total_repaid ?? 0)} />
          <Stat label="Overdue" value={inr(summary?.overdue_amount ?? 0)} danger={(summary?.overdue_amount ?? 0) > 0} />
        </View>
      </View>
      <Text style={s.section}>Entries</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        data={loans}
        keyExtractor={(l) => String(l.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={s.sub}>No entries yet. Tap + to add one.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => {
          const overdue = isOverdue(item);
          return (
            <View style={[s.item, overdue && s.itemOverdue, item.repaid_at && s.itemDone]}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.friend_name}</Text>
                <Text style={[s.sub, overdue && { color: '#b91c1c' }]}>
                  {item.repaid_at ? 'Repaid' : overdue ? `OVERDUE · due ${item.due_date}` : `Due ${item.due_date}`}
                </Text>
                {item.receipt_url && (
                  <Image source={{ uri: API_URL + item.receipt_url }} style={s.thumb} />
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{inr(item.amount)}</Text>
                {!item.repaid_at && (
                  <TouchableOpacity style={s.smallBtn} onPress={() => repay(item)}>
                    <Text style={s.smallBtnText}>Mark repaid</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
      <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
        <Text style={s.link}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.fab} onPress={() => setShowForm(true)}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
      <AddForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); load(); }}
      />
    </View>
  );
}

const Stat = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
  <View>
    <Text style={s.cardLabel}>{label}</Text>
    <Text style={[s.statVal, danger && { color: '#fecaca' }]}>{value}</Text>
  </View>
);

function AddForm({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [receipt, setReceipt] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) setReceipt(r.assets[0].uri);
  };

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Enter the friend name');
    if (!(Number(amount) > 0)) return Alert.alert('Enter a valid amount');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return Alert.alert('Due date must be YYYY-MM-DD');
    setBusy(true);
    try {
      await api.addLoan({ friend_name: name.trim(), amount, due_date: due, receiptUri: receipt });
      setName(''); setAmount(''); setDue(''); setReceipt(undefined);
      onSaved();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setBusy(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={s.safe}>
          <View style={{ padding: 16 }}>
            <Text style={s.title}>New entry</Text>
            <TextInput style={s.input} placeholder="Friend name" value={name} onChangeText={setName} />
            <TextInput style={s.input} placeholder="Amount (₹)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            <TextInput style={s.input} placeholder="Due date (YYYY-MM-DD)" value={due} onChangeText={setDue} />
            <TouchableOpacity style={s.outlineBtn} onPress={pick}>
              <Text style={s.link}>{receipt ? 'Change receipt photo' : 'Attach receipt photo (optional)'}</Text>
            </TouchableOpacity>
            {receipt && <Image source={{ uri: receipt }} style={s.preview} />}
            <TouchableOpacity style={s.btn} disabled={busy} onPress={submit}>
              <Text style={s.btnText}>{busy ? 'Saving…' : 'Save entry'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={[s.link, { textAlign: 'center', marginTop: 12 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loginBox: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  sub: { color: '#64748b', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  outlineBtn: { borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  link: { color: '#4f46e5', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { backgroundColor: '#4f46e5', borderRadius: 16, padding: 18, marginVertical: 12 },
  cardLabel: { color: '#c7d2fe', fontSize: 12 },
  cardBig: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 14 },
  statVal: { color: '#fff', fontSize: 16, fontWeight: '600' },
  section: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#0f172a' },
  item: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  itemOverdue: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  itemDone: { opacity: 0.6 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  amount: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  smallBtn: { marginTop: 8, backgroundColor: '#eef2ff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  smallBtnText: { color: '#4f46e5', fontWeight: '600', fontSize: 12 },
  thumb: { width: 48, height: 48, borderRadius: 6, marginTop: 6 },
  preview: { width: '100%', height: 160, borderRadius: 10, marginBottom: 12 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  logoutBtn: { position: 'absolute', left: 20, bottom: 40, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  fabText: { color: '#fff', fontSize: 30, marginTop: -2 },
});