import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, FlatList, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import { displayDate, MAX_QUANTITY, today, validateProfile } from '../core/model';
import type { Draft, Evaluation, Profile, Purpose } from '../core/model';
import type { Store } from '../core/store';
import type { CatalogEntry } from '../core/catalog';
import { openStore } from '../services/storage';
import { shareExport, writeExport } from '../services/export';
import { selectCatalog } from '../services/catalog-import';

const colors = { navy: '#082C46', muted: '#546D80', lime: '#A9B900', bg: '#F2F6F8', border: '#CFDCE5', green: '#296A46' };
const blank = (purpose: Purpose): Draft => ({ rowId: Crypto.randomUUID(), date: today(), quantity: '', observation: '', purpose });
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

function Button({ title, onPress, secondary = false, disabled = false }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || pressed) && { opacity: 0.5 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.navy }]}>{title}</Text>
  </Pressable>;
}
function Field({ label, value, onChangeText, placeholder, numeric = false, multiline = false }: {
  label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; numeric?: boolean; multiline?: boolean;
}) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label}
    style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText}
    keyboardType={numeric ? 'number-pad' : 'default'} placeholder={placeholder} placeholderTextColor="#788C9B"
    multiline={multiline} autoCapitalize="none" /></View>;
}

export default function CollectionScreen() {
  const { width } = useWindowDimensions();
  const store = useRef<Store | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allCatalog, setAllCatalog] = useState<CatalogEntry[]>([]);
  const [bucket, setBucket] = useState('');
  const [lookup, setLookup] = useState('');
  const [records, setRecords] = useState<Evaluation[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [bucketList, setBucketList] = useState('');
  const [history, setHistory] = useState(false);
  const [dateRow, setDateRow] = useState<string | null>(null);
  const [exportInfo, setExportInfo] = useState<{ at: string | null; pending: number }>({ at: null, pending: 0 });
  const catalog = allCatalog.filter(e => e.cycle === profile?.cycle && e.block === profile?.block).map(e => e.bucket);

  const loadBucket = useCallback((selected: string, rows: Evaluation[], current: Profile) => {
    const saved = rows.filter(r => r.cycle === current.cycle && r.block === current.block && r.bucket === selected && r.user_id === current.userId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const next: Draft[] = saved.map(r => ({ rowId: r.record_id, date: r.date, quantity: String(r.quantity), observation: r.observation, purpose: r.purpose }));
    for (const purpose of ['EMASC', 'POLI'] as const) if (!next.some(r => r.purpose === purpose)) next.push(blank(purpose));
    setBucket(selected); setLookup(selected); setDrafts(next); setDirty(false); setNotice('');
  }, []);
  const initialize = useCallback(async () => {
      const storage = await openStore();
      const current = await storage.getProfile(); const entries = await storage.getCatalog(); const rows = await storage.all();
      return { storage, current, entries, rows, exportState: await storage.exportState(rows) };
  }, []);
  useEffect(() => {
    let active = true;
    void initialize().then(({ storage, current, entries, rows, exportState }) => {
      if (!active) return;
      store.current = storage;
      const buckets = entries.filter(e => e.cycle === current.cycle && e.block === current.block).map(e => e.bucket);
      setProfile(current); setAllCatalog(entries); setRecords(rows); setExportInfo(exportState);
      if (buckets.length) loadBucket(buckets[0], rows, current);
      if (!current.userName || !current.cycle || !current.block || !buckets.length) {
        setEditingProfile(current); setBucketList(''); setSettings(true);
      }
    }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialize, loadBucket, retry]);

  const guard = useCallback((action: () => void) => {
    if (!dirty) return action();
    Alert.alert('Há alterações sem salvar', 'Volte ao formulário para salvar ou descarte as alterações antes de continuar.', [
      { text: 'Voltar', style: 'cancel' }, { text: 'Descartar e continuar', style: 'destructive', onPress: action },
    ]);
  }, [dirty]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirty) return false;
      guard(() => BackHandler.exitApp()); return true;
    });
    return () => subscription.remove();
  }, [dirty, guard]);
  // No network dependency. Returning to the app never resets the active form.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && dirty) setNotice('Existem alterações no formulário. Toque em Salvar para gravá-las.');
    });
    return () => subscription.remove();
  }, [dirty]);

  function change(rowId: string, patch: Partial<Draft>) {
    setDrafts(current => current.map(row => row.rowId === rowId ? { ...row, ...patch } : row)); setDirty(true); setNotice('');
  }
  async function save() {
    if (!profile || !store.current || busy) return;
    setBusy(true);
    try {
      const changed = await store.current.save(profile, bucket, drafts, catalog);
      const rows = await store.current.all(); setRecords(rows); setExportInfo(await store.current.exportState(rows));
      loadBucket(bucket, rows, profile); setNotice(changed ? `${changed} avaliação(ões) salva(s) no aparelho.` : 'Os registros já estavam salvos.');
    } catch (e) { Alert.alert('Confira a coleta', message(e)); } finally { setBusy(false); }
  }
  async function saveSettings() {
    if (!editingProfile || !store.current) return;
    setBusy(true);
    try {
      const current = { ...editingProfile, userName: editingProfile.userName.trim(), cycle: editingProfile.cycle.trim(), block: editingProfile.block.trim() };
      validateProfile(current);
      const entered = bucketList.split(/[\s,;]+/).filter(Boolean);
      const entries = await store.current.mergeCatalog(entered.map(bucket => ({ cycle: current.cycle, block: current.block, bucket })));
      const buckets = entries.filter(e => e.cycle === current.cycle && e.block === current.block).map(e => e.bucket);
      if (!buckets.length) throw new Error('Importe o cadastro deste bloco/safra ou informe os baldes.');
      await store.current.setProfile(current);
      setProfile(current); setAllCatalog(entries); loadBucket(buckets.includes(bucket) ? bucket : buckets[0], records, current);
      setSettings(false);
    } catch (e) { Alert.alert('Confira a configuração', message(e)); } finally { setBusy(false); }
  }
  async function importCatalog() {
    if (!store.current || !editingProfile) return;
    setBusy(true);
    try {
      const result = await selectCatalog(editingProfile.cycle.trim());
      if (!result) return;
      const contexts = new Set(result.entries.map(e => JSON.stringify([e.cycle, e.block])));
      Alert.alert('Conferir cadastro', `${result.filename}\n${result.entries.length} vínculos entre bloco e balde, em ${contexts.size} bloco(s)/safra(s).\n${result.duplicates} linha(s) repetida(s) ignorada(s).\n\nAdicionar este cadastro? Os registros coletados serão preservados.`, [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Importar', onPress: () => { void (async () => {
          setBusy(true);
          try {
            const entries = await store.current!.mergeCatalog(result.entries); setAllCatalog(entries);
            const chosen = entries.some(e => e.cycle === editingProfile.cycle && e.block === editingProfile.block) ? editingProfile : { ...editingProfile, cycle: result.entries[0].cycle, block: result.entries[0].block };
            setEditingProfile(chosen); setBucketList('');
            Alert.alert('Cadastro importado', 'Confira o coletor e o bloco e toque em Salvar configuração.');
          } catch (e) { Alert.alert('Cadastro', message(e)); } finally { setBusy(false); }
        })(); } },
      ]);
    } catch (e) { Alert.alert('Não foi possível importar', message(e)); } finally { setBusy(false); }
  }
  async function exportCsv() {
    if (!profile || !store.current || busy) return;
    if (dirty) { Alert.alert('Salve antes de exportar', 'O formulário tem alterações. Salve-as para incluir no CSV.'); return; }
    setBusy(true);
    try {
      const snapshot = await store.current.all();
      if (!snapshot.length) throw new Error('Ainda não há avaliações salvas para exportar.');
      const file = writeExport(profile, snapshot);
      await store.current.markExport(snapshot); setExportInfo(await store.current.exportState(snapshot));
      setNotice('CSV gerado no aparelho. Escolha onde salvar/enviar e confirme a transferência no destino.');
      await shareExport(file);
    } catch (e) { Alert.alert('Exportação', message(e)); } finally { setBusy(false); }
  }
  function navigate(target: string) {
    if (!catalog.includes(target)) { Alert.alert('Balde não cadastrado', 'Confira o número ou adicione o balde em Configurar.'); return; }
    if (profile) guard(() => loadBucket(target, records, profile));
  }
  const currentIndex = catalog.indexOf(bucket);
  const contextRows = records.filter(r => r.cycle === profile?.cycle && r.block === profile?.block);
  const assessed = new Set(contextRows.map(r => r.bucket)).size;

  if (loading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.navy} /><Text>Preparando os registros…</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.loading}><Text style={styles.heading}>Não foi possível abrir os dados</Text><Text>{error}</Text><Button title="Tentar novamente" onPress={() => { setLoading(true); setError(''); setRetry(current => current + 1); }} /></SafeAreaView>;

  return <SafeAreaView style={styles.root}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <View style={styles.topline}><Text style={styles.eyebrow}>BLOCO DE CRUZAMENTO</Text><Text style={styles.offline}>Coleta offline</Text></View>
        <Text style={styles.title}>Registro de BC</Text>
        <Text style={styles.subtitle}>Disponibilidade de espigas</Text>
        <Text style={styles.context}>{profile?.userName || 'Configure o coletor'} · {profile?.cycle || 'Safra'} · {profile?.block || 'Bloco'}</Text>
        <View style={styles.actions}>
          <Button title="Configurar" secondary disabled={busy} onPress={() => guard(() => { setEditingProfile(profile); setBucketList(''); setSettings(true); })} />
          <Button title="Histórico" secondary disabled={busy} onPress={() => guard(() => setHistory(true))} />
        </View>
        <View style={styles.bucketCard}>
          <Text style={styles.eyebrow}>BALDE</Text>
          <View style={styles.bucketNavigation}>
            <Button title="‹" secondary disabled={busy || currentIndex <= 0} onPress={() => navigate(catalog[currentIndex - 1])} />
            <TextInput accessibilityLabel="Número do balde" style={styles.bucketInput} keyboardType="number-pad" value={lookup} onChangeText={setLookup} onSubmitEditing={() => navigate(lookup.trim())} />
            <Button title="›" secondary disabled={busy || currentIndex < 0 || currentIndex >= catalog.length - 1} onPress={() => navigate(catalog[currentIndex + 1])} />
          </View>
          <Button title="Ir para o balde" secondary disabled={busy || !lookup} onPress={() => navigate(lookup.trim())} />
          <Text style={styles.hint}>{assessed} de {catalog.length} baldes avaliados neste bloco/safra</Text>
        </View>
        <View style={[styles.cards, width >= 850 && { flexDirection: 'row' }]}>
          {(['EMASC', 'POLI'] as const).map(purpose => <View key={purpose} style={styles.card}>
            <View style={styles.sectionHeading}><View style={styles.accent} /><Text style={styles.heading}>{purpose === 'EMASC' ? 'Emasculação' : 'Polinização'}</Text></View>
            <Text style={styles.hint}>Registre a quantidade disponível em cada data.</Text>
            {drafts.filter(row => row.purpose === purpose).map(row => <View key={row.rowId} style={styles.evaluation}>
              <View style={styles.row}>
                <View style={{ flex: 1.2 }}><Text style={styles.label}>{records.some(r => r.record_id === row.rowId) ? 'Data (salva)' : 'Data'}</Text><Pressable disabled={busy || records.some(r => r.record_id === row.rowId)} accessibilityRole="button" accessibilityLabel={`Data ${displayDate(row.date)}`} style={styles.input} onPress={() => setDateRow(row.rowId)}><Text style={styles.dateText}>{displayDate(row.date)}</Text></Pressable></View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Espigas</Text><TextInput editable={!busy} accessibilityLabel={`Espigas ${purpose} ${row.date}`} style={styles.input} keyboardType="number-pad" placeholder="Não avaliado" value={row.quantity} onChangeText={quantity => change(row.rowId, { quantity })} /></View>
              </View>
              <View style={styles.row}><Button title="−1" secondary disabled={busy || !row.quantity || Number(row.quantity) <= 0} onPress={() => change(row.rowId, { quantity: String(Number(row.quantity) - 1) })} /><Button title="+1" secondary disabled={busy || Number(row.quantity) >= MAX_QUANTITY} onPress={() => change(row.rowId, { quantity: String(Number(row.quantity || 0) + 1) })} /></View>
              <TextInput editable={!busy} accessibilityLabel={`Observação ${purpose} ${row.date}`} style={styles.input} maxLength={500} placeholder="Observação (opcional)" value={row.observation} onChangeText={observation => change(row.rowId, { observation })} />
            </View>)}
            <Button title="+ Outra data" secondary disabled={busy} onPress={() => { setDrafts(current => [...current, blank(purpose)]); setDirty(true); }} />
          </View>)}
        </View>
        {dirty && <Text style={styles.warning}>Alterações ainda não salvas.</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
        <Button title={busy ? 'Aguarde…' : 'Salvar registros'} disabled={busy || !bucket} onPress={() => void save()} />
        <Button title="Recarregar dados salvos" secondary disabled={busy || !bucket} onPress={() => { if (profile) guard(() => loadBucket(bucket, records, profile)); }} />
        <View style={styles.exportCard}><Text style={styles.heading}>Arquivo de coleta</Text><Text style={styles.hint}>{records.length} avaliações no aparelho · {exportInfo.pending} novas/alteradas desde o último CSV</Text>
          <Button title="Exportar CSV acumulado" secondary disabled={busy || !records.length} onPress={() => void exportCsv()} />
          <Text style={styles.hint}>A exportação inclui todas as safras e datas deste aparelho. Gerar o CSV não confirma sua chegada ao Excel.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    {dateRow && <DateTimePicker value={new Date(`${drafts.find(r => r.rowId === dateRow)?.date ?? today()}T12:00:00`)} mode="date" minimumDate={new Date(2000, 0, 1)} maximumDate={new Date(2100, 11, 31)} onChange={(event, date) => { const id = dateRow; setDateRow(null); if (event.type === 'set' && date) change(id, { date: today(date) }); }} />}
    <Modal visible={settings} animationType="slide" onRequestClose={() => { if (profile?.userName && catalog.length) setSettings(false); }}>
      <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Configurar coleta</Text><Text style={styles.hint}>Use este aparelho para um único coletor. O nome pode ser corrigido sem mudar a identidade do arquivo.</Text>
        {editingProfile && <>
          <Field label="Nome do coletor" value={editingProfile.userName} onChangeText={userName => setEditingProfile({ ...editingProfile, userName })} />
          <Button title="Importar cadastro CSV ou Excel" secondary disabled={busy} onPress={() => void importCatalog()} />
          <Text style={styles.hint}>Colunas: Safra, Bloco e Balde. Se Safra não existir no arquivo, será usada a safra informada abaixo.</Text>
          {[...new Map(allCatalog.map(e => [JSON.stringify([e.cycle, e.block]), e])).values()].map(e => <Button key={JSON.stringify([e.cycle, e.block])} title={`${e.cycle} · ${e.block}${editingProfile.cycle === e.cycle && editingProfile.block === e.block ? ' (selecionado)' : ''}`} secondary disabled={busy} onPress={() => { setEditingProfile({ ...editingProfile, cycle: e.cycle, block: e.block }); setBucketList(''); }} />)}
          <Field label="Safra/ciclo" placeholder="Ex.: 2026" value={editingProfile.cycle} onChangeText={cycle => setEditingProfile({ ...editingProfile, cycle })} />
          <Field label="Bloco" placeholder="Identificação usada no Excel" value={editingProfile.block} onChangeText={block => setEditingProfile({ ...editingProfile, block })} />
          <Field label="Adicionar baldes manualmente (opcional)" placeholder="Números separados por espaço, vírgula ou linha" value={bucketList} onChangeText={setBucketList} multiline />
          <Text style={styles.hint}>Os números serão vinculados somente à safra e ao bloco selecionados.</Text>
          <Button title="Salvar configuração" disabled={busy} onPress={() => void saveSettings()} />
          {!!profile?.userName && !!catalog.length && <Button title="Cancelar" secondary disabled={busy} onPress={() => setSettings(false)} />}
        </>}
      </ScrollView></SafeAreaView>
    </Modal>
    <Modal visible={history} animationType="slide" onRequestClose={() => setHistory(false)}>
      <SafeAreaView style={styles.root}><View style={styles.historyHeader}><Text style={styles.title}>Histórico do bloco</Text><Button title="Voltar" secondary onPress={() => setHistory(false)} /><Text style={styles.hint}>Toque em um registro para abrir o balde e corrigir os dados.</Text></View>
        <FlatList data={[...contextRows].sort((a, b) => b.updated_at.localeCompare(a.updated_at))} keyExtractor={r => r.record_id} contentContainerStyle={styles.historyList}
          ListEmptyComponent={<Text style={styles.hint}>Nenhum registro salvo neste bloco/safra.</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button" style={styles.card} onPress={() => { if (profile) loadBucket(item.bucket, records, profile); setHistory(false); }}><Text style={styles.heading}>Balde {item.bucket} · {item.quantity} espigas</Text><Text style={styles.context}>{displayDate(item.date)} · {item.purpose === 'EMASC' ? 'Emasculação' : 'Polinização'} · v{item.version}</Text>{!!item.observation && <Text>{item.observation}</Text>}</Pressable>} />
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  container: { padding: 20, gap: 14, width: '100%', maxWidth: 1180, alignSelf: 'center', paddingBottom: 44 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: colors.muted }, offline: { fontSize: 12, fontWeight: '600', color: colors.green },
  title: { fontSize: 32, fontWeight: '800', color: colors.navy, letterSpacing: -0.8 }, subtitle: { fontSize: 19, color: colors.muted, marginTop: -10 },
  context: { fontSize: 14, color: colors.muted }, hint: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 }, button: { backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.navy, borderRadius: 12, minHeight: 50, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: '#FFFFFF', borderColor: colors.border }, buttonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  bucketCard: { padding: 18, backgroundColor: '#E8F0F6', borderRadius: 18, gap: 12 }, bucketNavigation: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bucketInput: { flex: 1, minHeight: 58, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, textAlign: 'center', fontSize: 30, fontWeight: '800', color: colors.navy },
  cards: { gap: 16 }, card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, accent: { width: 6, height: 26, borderRadius: 3, backgroundColor: colors.lime }, heading: { fontSize: 21, fontWeight: '700', color: colors.navy },
  evaluation: { gap: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E9EEF2' }, row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  field: { gap: 6 }, label: { fontSize: 14, fontWeight: '600', color: colors.navy, marginBottom: 6 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: colors.navy }, dateText: { fontSize: 16, color: colors.navy },
  notice: { backgroundColor: '#E8F4EB', padding: 14, borderRadius: 10, color: colors.green, lineHeight: 22 }, warning: { color: '#875B0A', fontWeight: '600' },
  exportCard: { marginTop: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: 20, gap: 12 }, historyHeader: { padding: 20, gap: 12 }, historyList: { padding: 20, gap: 12 },
});
