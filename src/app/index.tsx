import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import { displayDate, exportFilename, MAX_QUANTITY, today } from '../core/model';
import type { Draft, OutputTarget, Profile } from '../core/model';
import type { CatalogEntry } from '../core/catalog';
import type { Store } from '../core/store';
import { changeSheetDate, SaveQueue } from '../core/collection';
import { exportDevice } from '../core/export-flow';
import { openStore } from '../services/storage';
import { chooseOutput, exportCsv, shareCsv } from '../services/export';
import { selectCatalog } from '../services/catalog-import';

const colors = { ink: '#123047', muted: '#597080', line: '#D6E0E5', field: '#F4F7F8', paper: '#FFFFFF', green: '#35624C', red: '#AA3030' };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
type Context = { profile: Profile; catalog: CatalogEntry[]; bucket: string; drafts: Draft[] };
type Panel = 'user' | 'settings' | 'block' | 'bucket' | 'quantity' | 'observation' | null;
type User = Pick<Profile, 'userId' | 'userName'>;
type IconName = React.ComponentProps<typeof Feather>['name'];

function IconButton({ icon, label, onPress, disabled = false }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    style={({ pressed }) => [styles.iconButton, (pressed || disabled) && { opacity: 0.4 }]} onPress={onPress}>
    <Feather name={icon} size={23} color={colors.ink} />
  </Pressable>;
}
function Action({ text, onPress, disabled = false }: { text: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    onPress={onPress} style={({ pressed }) => [styles.action, (disabled || pressed) && { opacity: 0.4 }]}>
    <Text style={styles.actionText}>{text}</Text>
  </Pressable>;
}

export default function CollectionScreen() {
  const { width, height } = useWindowDimensions();
  const store = useRef<Store | null>(null);
  const contextRef = useRef<Context | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [edit, setEdit] = useState('');
  const [rowId, setRowId] = useState<string | null>(null);
  const [dateRow, setDateRow] = useState<string | null>(null);
  const [source, setSource] = useState('Nenhum arquivo importado');
  const [target, setTarget] = useState<OutputTarget | null>(null);
  const [pending, setPending] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');
  const revision = useRef(0);
  const validationRef = useRef<string | null>(null);
  const queue = useRef<SaveQueue | null>(null);
  if (queue.current === null) queue.current = new SaveQueue((count, error) => { setPending(count); setSaveError(error ? message(error) : ''); });

  const show = useCallback((next: Context) => { contextRef.current = next; setContext(next); }, []);
  const reload = useCallback(async (profile: Profile, catalog: CatalogEntry[], selected?: string) => {
    const matching = catalog.filter(e => e.block === profile.block && e.cycle === profile.cycle);
    const entry = matching[0] ?? catalog[0];
    const nextProfile = entry ? { ...profile, block: entry.block, cycle: entry.cycle } : { ...profile, block: '', cycle: '' };
    const buckets = catalog.filter(e => e.block === nextProfile.block && e.cycle === nextProfile.cycle).map(e => e.bucket);
    const bucket = selected && buckets.includes(selected) ? selected : buckets[0] ?? '';
    await store.current!.setProfile(nextProfile);
    const drafts = bucket ? await store.current!.loadSheet(nextProfile, bucket) : [];
    validationRef.current = null; setValidation('');
    show({ profile: nextProfile, catalog, bucket, drafts });
    setTarget(await store.current!.setting<OutputTarget | null>('outputDevice', null)
      ?? await store.current!.setting<OutputTarget | null>('outputFolder', null));
  }, [show]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const storage = await openStore(); if (!active) return; store.current = storage;
      const profile = await storage.getProfile();
      const catalog = await storage.getCatalog();
      await reload(profile, catalog, await storage.setting<string>('activeBucket', ''));
      setUsers(await storage.users());
      setSource(await storage.setting('catalogSource', 'Nenhum arquivo importado'));
      if (!profile.userName) { setEdit(''); setPanel('user'); }
      else if (!catalog.length) setPanel('settings');
    })().catch(e => { if (active) setFatal(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, retry]);

  function persist(next: Context) {
    if (!next.profile.userName || !next.bucket || !next.drafts.length || !store.current) return;
    const version = ++revision.current;
    const snapshot = { ...next, drafts: next.drafts.map(r => ({ ...r })) };
    queue.current!.enqueue(async () => {
      const error = await store.current!.saveSheet(snapshot.profile, snapshot.bucket, snapshot.drafts,
        snapshot.catalog.filter(e => e.block === snapshot.profile.block && e.cycle === snapshot.profile.cycle).map(e => e.bucket));
      if (version === revision.current) { validationRef.current = error; setValidation(error ?? ''); }
    }, JSON.stringify([next.profile.userId, next.profile.block, next.profile.cycle, next.bucket]));
  }
  async function flush() {
    if (contextRef.current) persist(contextRef.current);
    await queue.current!.flush();
    if (validationRef.current) throw new Error(validationRef.current);
  }
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; });
  useEffect(() => {
    const app = AppState.addEventListener('change', state => {
      // Actions flush first and disable editing. Do not enqueue an old context during reset.
      if (state !== 'active' && !busyRef.current) void flushRef.current().catch(() => {});
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busyRef.current) return true;
      busyRef.current = true;
      void flushRef.current().then(() => BackHandler.exitApp()).catch(e => {
        Alert.alert('Dados mantidos no aparelho', message(e));
      }).finally(() => { busyRef.current = false; });
      return true;
    });
    return () => { app.remove(); back.remove(); };
  }, []);

  async function run(action: () => Promise<void>, save = true) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); Keyboard.dismiss(); setNotice('');
    try { if (save) await flush(); await action(); }
    catch (e) { Alert.alert('Registro de BC', message(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function change(id: string, patch: Partial<Draft>) {
    const current = contextRef.current; if (!current || busyRef.current) return;
    const drafts = current.drafts.map(r => r.rowId === id ? { ...r, ...patch } : r);
    const next = { ...current, drafts }; show(next); setNotice(''); persist(next);
  }
  function step(row: Draft, amount: number) {
    change(row.rowId, { quantity: String(Math.max(0, Math.min(MAX_QUANTITY, (Number(row.quantity) || 0) + amount))) });
  }
  function openPanel(next: Panel, row?: Draft) {
    setRowId(row?.rowId ?? null); setEdit(next === 'user' || next === 'bucket' ? '' : next === 'quantity' ? row?.quantity ?? '0' : row?.observation ?? ''); setPanel(next);
  }
  async function selectUser(name: string) {
    await run(async () => {
      const profile = await store.current!.selectUser(name);
      await reload(profile, contextRef.current!.catalog, contextRef.current!.bucket);
      setUsers(await store.current!.users()); setPanel(contextRef.current!.catalog.length ? null : 'settings');
    });
  }
  async function navigate(bucket: string) {
    await run(async () => {
      const current = contextRef.current!; await reload(current.profile, current.catalog, bucket); setPanel(null);
    });
  }
  function deleteUser(user: User) {
    Alert.alert('Excluir usuário?', `${user.userName} será removido da lista. As coletas anteriores continuarão no aparelho e no CSV.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void run(async () => {
        const current = contextRef.current!;
        const profile = await store.current!.deleteUser(user.userId);
        await reload(profile, current.catalog, current.bucket);
        setUsers(await store.current!.users()); setEdit(''); setPanel('user');
      }) },
    ]);
  }
  async function importCatalog() {
    await run(async () => {
      const result = await selectCatalog(); if (!result) return;
      const entries = await store.current!.replaceCatalog(result.entries, result.filename);
      const current = contextRef.current!;
      await reload(current.profile, entries, current.bucket); setSource(result.filename);
    });
  }
  async function selectOutput(kind: 'folder' | 'create' | 'open') {
    await run(async () => {
      const profile = contextRef.current!.profile;
      if (!profile.userName) throw new Error('Escolha o usuário no ícone superior esquerdo.');
      const selected = await chooseOutput(profile, kind); if (!selected) return;
      await store.current!.setSetting('outputDevice', selected);
      if (selected.kind === 'folder') await store.current!.setSetting('outputFolder', selected);
      setTarget(selected);
    });
  }
  async function exportCurrent() {
    await run(async () => {
      const current = contextRef.current!;
      if (!current.profile.userName) { openPanel('user'); return; }
      if (!target) { setPanel('settings'); Alert.alert('Destino do CSV', 'Escolha a pasta ou o arquivo de saída. Depois toque no ícone de exportação.'); return; }
      const records = await exportDevice(store.current!, current.profile, records => exportCsv(current.profile, records, target));
      await reload(current.profile, current.catalog, current.bucket);
      setNotice('CSV atualizado · nova coleta');
      Alert.alert('CSV atualizado', `${exportFilename(current.profile)}\n${records.length} registros de todos os usuários deste aparelho.\n\nFormulário limpo. O histórico foi preservado. Se o destino for OneDrive, confira a sincronização no OneDrive.`);
    });
  }
  async function sendCopy() {
    await run(async () => {
      const current = contextRef.current!;
      await shareCsv(current.profile, await store.current!.all());
      setNotice('Confira o envio no aplicativo escolhido');
    });
  }
  async function pickDate(id: string, date: string) {
    await run(async () => {
      await queue.current!.flush();
      const current = contextRef.current!;
      const next = { ...current, drafts: changeSheetDate(current.drafts, id, date, await store.current!.all(), current.profile, current.bucket) };
      show(next); persist(next);
    }, false);
  }
  function finishEdit(value: string) {
    if (!rowId) return;
    if (panel === 'quantity') {
      if (!/^\d+$/.test(value) || Number(value) > MAX_QUANTITY) { Alert.alert('Espigas', `Use um número inteiro entre 0 e ${MAX_QUANTITY}.`); return; }
      change(rowId, { quantity: String(Number(value)) });
    } else change(rowId, { observation: value });
    setPanel(null);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.ink} /></SafeAreaView>;
  if (fatal || !context) return <SafeAreaView style={styles.center}><Text>{fatal || 'Não foi possível abrir o aplicativo.'}</Text><Action text="Tentar novamente" onPress={() => { setFatal(''); setLoading(true); setRetry(r => r + 1); }} /></SafeAreaView>;
  const { profile, catalog, bucket, drafts } = context;
  const buckets = catalog.filter(e => e.block === profile.block && e.cycle === profile.cycle).map(e => e.bucket);
  const bucketIndex = buckets.indexOf(bucket);
  const blocks = [...new Map(catalog.map(e => [JSON.stringify([e.cycle, e.block]), e])).values()];
  const landscape = width > 600 && height < 600;
  const issue = saveError || validation;
  const title = panel === 'user' ? 'Usuário' : panel === 'settings' ? 'Configurações' : panel === 'block' ? 'Bloco de cruzamento' : panel === 'bucket' ? 'Escolher balde' : panel === 'quantity' ? 'Espigas' : 'Observação';
  const available = buckets.filter(b => !edit || b.includes(edit.trim())).slice(0, 120);

  return <SafeAreaView style={styles.root}>
    <View style={styles.screen}>
      <View style={styles.top}>
        <IconButton icon="user" label={`Usuário: ${profile.userName || 'Escolher'}`} disabled={busy} onPress={() => openPanel('user')} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Escolher bloco: ${profile.block}`} disabled={busy} style={styles.block} onPress={() => openPanel('block')}>
          <Text numberOfLines={1} style={styles.blockName}>{profile.block || 'Escolher BC'}</Text><Feather name="chevron-down" size={16} color={colors.ink} />
        </Pressable>
        <IconButton icon="settings" label="Configurações" disabled={busy} onPress={() => openPanel('settings')} />
        <IconButton icon="upload" label="Exportar CSV" disabled={busy} onPress={() => void exportCurrent()} />
      </View>
      <View style={styles.bucketNav}>
        <IconButton icon="chevron-left" label="Balde anterior" disabled={busy || bucketIndex <= 0} onPress={() => void navigate(buckets[bucketIndex - 1])} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Balde ${bucket || 'não selecionado'}. Escolher balde`} disabled={busy} style={styles.bucketChoice} onPress={() => openPanel('bucket')}>
          <Text style={styles.bucketLabel}>BALDE</Text><Text maxFontSizeMultiplier={1.3} style={styles.bucketNumber}>{bucket || '—'}</Text>
        </Pressable>
        <IconButton icon="chevron-right" label="Próximo balde" disabled={busy || bucketIndex < 0 || bucketIndex >= buckets.length - 1} onPress={() => void navigate(buckets[bucketIndex + 1])} />
      </View>
      {drafts.length ? <View style={[styles.groups, landscape && styles.horizontal]}>
        {(['EMASC', 'POLI'] as const).map(purpose => <View key={purpose} style={styles.group}>
          <Text style={styles.groupTitle}>{purpose === 'EMASC' ? 'Emasculação' : 'Polinização'}</Text>
          <View style={styles.rowLabels}><Text style={[styles.label, styles.dateColumn]}>Data</Text><Text style={[styles.label, styles.countColumn]}>Espigas</Text><Text numberOfLines={1} style={[styles.label, styles.obsColumn]}>Observação</Text></View>
          {drafts.filter(r => r.purpose === purpose).map(row => <View key={row.rowId} style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Data ${purpose}: ${row.date ? displayDate(row.date) : 'Escolher'}`} disabled={busy} style={[styles.field, styles.dateColumn]} onPress={() => setDateRow(row.rowId)}>
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.fieldText}>{row.date ? displayDate(row.date).slice(0, 6) + row.date.slice(2, 4) : '—'}</Text>
            </Pressable>
            <View style={styles.countColumn}>
              <View style={styles.counter}>
                <IconButton icon="arrow-down" label={`Diminuir espigas ${purpose} ${row.date}`} disabled={busy || Number(row.quantity) <= 0} onPress={() => step(row, -1)} />
                <Pressable accessibilityRole="button" accessibilityLabel={`Editar espigas ${purpose}: ${row.quantity}`} disabled={busy} style={styles.quantity} onPress={() => openPanel('quantity', row)}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.quantityText}>{row.quantity || '—'}</Text>
                </Pressable>
                <IconButton icon="arrow-up" label={`Somar espigas ${purpose} ${row.date}`} disabled={busy || Number(row.quantity) >= MAX_QUANTITY} onPress={() => step(row, 1)} />
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Observação ${purpose}: ${row.observation || 'Selecionar ou digitar'}`} disabled={busy} style={[styles.field, styles.obsColumn, styles.observation]} onPress={() => openPanel('observation', row)}>
              <Text numberOfLines={1} style={styles.observationText}>{row.observation || '—'}</Text><Feather name="chevron-down" size={12} color={colors.muted} />
            </Pressable>
          </View>)}
        </View>)}
      </View> : <View style={styles.center}><Action text="Importar cadastro de baldes" disabled={busy} onPress={() => openPanel('settings')} /></View>}
      <Pressable disabled={!issue || busy} onPress={() => void run(async () => {}, true)} accessibilityRole={issue ? 'button' : undefined} style={styles.status}>
        {pending || busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Feather name={issue ? 'alert-circle' : 'check-circle'} size={14} color={issue ? colors.red : colors.green} />}
        <Text accessibilityLiveRegion="polite" numberOfLines={2} style={[styles.statusText, issue && { color: colors.red }]}>{issue ? `${issue} Toque para tentar novamente.` : pending ? 'Gravando no aparelho…' : notice || `${profile.userName || 'Escolha o usuário'} · No aparelho`}</Text>
      </Pressable>
    </View>

    {dateRow && <DateTimePicker value={new Date(`${drafts.find(r => r.rowId === dateRow)?.date || today()}T12:00:00`)} mode="date" minimumDate={new Date(2000, 0, 1)} maximumDate={new Date(2100, 11, 31)} onChange={(event, date) => { const id = dateRow; setDateRow(null); if (event.type === 'set' && date) void pickDate(id, today(date)); }} />}
    <Modal visible={!!panel} transparent animationType="fade" onRequestClose={() => { if (!busy && (panel !== 'user' || profile.userName)) setPanel(null); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><IconButton icon="x" label="Fechar" disabled={busy || (panel === 'user' && !profile.userName)} onPress={() => setPanel(null)} /></View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
              {panel === 'user' && <>
                {users.map(u => <View key={u.userId} style={styles.userRow}>
                  <View style={{ flex: 1 }}><Action disabled={busy} text={`${u.userName}${u.userId === profile.userId ? ' ✓' : ''}`} onPress={() => void selectUser(u.userName)} /></View>
                  <IconButton icon="trash-2" label={`Excluir usuário ${u.userName}`} disabled={busy} onPress={() => deleteUser(u)} />
                </View>)}
                <Text style={styles.hint}>Identificação pelo nome</Text>
                <TextInput accessibilityLabel="Nome do usuário" editable={!busy} style={styles.input} value={edit} onChangeText={setEdit} placeholder="Nome do usuário" maxLength={80} autoCapitalize="words" />
                <Action disabled={busy || !edit.trim()} text="Usar este nome" onPress={() => void selectUser(edit)} />
              </>}
              {panel === 'settings' && <>
                <Text style={styles.label}>Cadastro: Nome do Bloco · Balde</Text><Text style={styles.hint}>{source}</Text>
                <Action disabled={busy} text="Importar CSV ou Excel" onPress={() => void importCatalog()} />
                <Text style={styles.label}>CSV único deste aparelho · todos os usuários</Text>
                <Text style={styles.hint}>{target ? `${target.kind === 'folder' ? 'Pasta' : 'Arquivo'}: ${target.name}` : 'Destino não selecionado'}</Text>
                {!!profile.userName && <Text style={styles.filename}>{exportFilename(profile)}</Text>}
                <Action disabled={busy} text="Escolher pasta de saída" onPress={() => void selectOutput('folder')} />
                <Action disabled={busy} text="Criar arquivo de saída" onPress={() => void selectOutput('create')} />
                <Action disabled={busy} text="Escolher CSV existente" onPress={() => void selectOutput('open')} />
                <Text style={styles.hint}>O destino será lembrado para todos os usuários. A gravação confirmada limpa as datas, quantidades e observações da tela.</Text>
                <Action disabled={busy} text="Enviar cópia (OneDrive…)" onPress={() => void sendCopy()} />
                <Text style={styles.hint}>OneDrive não aparece no seletor? Use Enviar cópia e escolha OneDrive entre os aplicativos disponíveis. Confirme o envio nele. Compartilhar não limpa o formulário, pois o app não consegue confirmar a transferência.</Text>
              </>}
              {panel === 'block' && <>
                {!blocks.length && <Action text="Importar cadastro" onPress={() => setPanel('settings')} />}
                {blocks.map(e => <Action key={JSON.stringify([e.cycle, e.block])} disabled={busy} text={e.block} onPress={() => void run(async () => { await reload({ ...profile, block: e.block, cycle: e.cycle }, catalog); setPanel(null); })} />)}
              </>}
              {panel === 'bucket' && <>
                <TextInput accessibilityLabel="Filtrar número do balde" style={styles.input} value={edit} onChangeText={setEdit} keyboardType="number-pad" placeholder="Número do balde" />
                <View style={styles.bucketGrid}>{available.map(b => <Action key={b} text={b} disabled={busy} onPress={() => void navigate(b)} />)}</View>
                {!available.length && <Text style={styles.hint}>Nenhum balde encontrado.</Text>}
                {buckets.filter(b => !edit || b.includes(edit.trim())).length > 120 && <Text style={styles.hint}>Digite mais números para refinar.</Text>}
              </>}
              {panel === 'quantity' && <>
                <TextInput accessibilityLabel="Quantidade de espigas" autoFocus selectTextOnFocus style={[styles.input, styles.largeInput]} keyboardType="number-pad" maxLength={6} value={edit} onChangeText={value => {
                  setEdit(value);
                  if (rowId) change(rowId, { quantity: value });
                }} onSubmitEditing={() => finishEdit(edit)} />
                <Action disabled={busy} text="Concluir" onPress={() => finishEdit(edit)} />
              </>}
              {panel === 'observation' && <>
                {['', 'PASSADA', 'VEGETATIVO', 'NÃO GERMINOU'].map(value => <Action key={value} text={value || 'Em branco'} onPress={() => finishEdit(value)} />)}
                <TextInput accessibilityLabel="Observação livre" style={[styles.input, styles.multiline]} multiline maxLength={500} value={edit} onChangeText={value => {
                  setEdit(value); if (rowId) change(rowId, { observation: value });
                }} placeholder="Texto livre" />
                <Action text="Concluir" onPress={() => finishEdit(edit)} />
              </>}
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper }, center: { flex: 1, padding: 20, gap: 14, justifyContent: 'center', alignItems: 'center' },
  screen: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 10, paddingBottom: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 48 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  block: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' },
  blockName: { flexShrink: 1, color: colors.ink, fontWeight: '700', fontSize: 15 },
  bucketNav: { height: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  bucketChoice: { flex: 1, alignItems: 'center', justifyContent: 'center' }, bucketLabel: { fontSize: 11, color: colors.muted, letterSpacing: 1 },
  bucketNumber: { fontSize: 35, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  groups: { flex: 1, gap: 12 }, horizontal: { flexDirection: 'row' },
  group: { flex: 1, borderTopWidth: 1, borderColor: colors.line, paddingTop: 8, gap: 5 },
  groupTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  rowLabels: { flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 20 }, label: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  row: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center' },
  dateColumn: { flex: 1, minWidth: 66 }, countColumn: { width: 132 }, obsColumn: { flex: 0.85, minWidth: 66 },
  field: { height: 44, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  fieldText: { fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  counter: { flexDirection: 'row', height: 44, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line, borderRadius: 8, alignItems: 'center' },
  quantity: { width: 42, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  quantityText: { fontSize: 18, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  observation: { flexDirection: 'row', gap: 2, justifyContent: 'space-between' }, observationText: { flex: 1, fontSize: 12, color: colors.ink },
  status: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6 }, statusText: { flex: 1, fontSize: 11, color: colors.green },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 14 },
  modalSafe: { maxHeight: '100%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  modalCard: { maxHeight: '100%', backgroundColor: colors.paper, borderRadius: 18, padding: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { flex: 1, fontSize: 20, color: colors.ink, fontWeight: '700' }, modalContent: { gap: 12, paddingBottom: 10 },
  action: { minHeight: 44, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.field, justifyContent: 'center' },
  actionText: { fontSize: 15, color: colors.ink }, hint: { fontSize: 13, lineHeight: 19, color: colors.muted }, filename: { fontSize: 13, color: colors.ink },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top' }, largeInput: { fontSize: 30, textAlign: 'center' },
  bucketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
