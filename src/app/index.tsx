import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import { displayDate, exportFilename, MAX_QUANTITY, today } from '../core/model';
import type { Draft, OutputTarget, Profile } from '../core/model';
import type { CatalogEntry, CatalogSource } from '../core/catalog';
import type { Store } from '../core/store';
import { changeSheetDate, SaveQueue, sheetDates, VISIBLE_ROWS } from '../core/collection';
import { collectionLayout } from '../core/screen-layout';
import { exportDevice } from '../core/export-flow';
import { startNewBlock } from '../core/block-reset';
import { openStore } from '../services/storage';
import { chooseOutput, clearInternalCollectionFiles, exportCsv, shareCsv } from '../services/export';
import { reloadCatalog, selectCatalog } from '../services/catalog-import';

const colors = { ink: '#123047', muted: '#597080', line: '#D6E0E5', field: '#F4F7F8', paper: '#FFFFFF', green: '#35624C', red: '#AA3030' };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
type Context = { profile: Profile; catalog: CatalogEntry[]; bucket: string; drafts: Draft[]; priority: boolean };
type Panel = 'user' | 'settings' | 'new-block' | 'export-result' | 'output' | 'block' | 'bucket' | 'quantity' | 'observation' | null;
type User = Pick<Profile, 'userId' | 'userName'>;
type IconName = React.ComponentProps<typeof Feather>['name'];

function IconButton({ icon, label, onPress, disabled = false, large = false, size, box = 44, boxHeight = box }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; large?: boolean; size?: number; box?: number; boxHeight?: number }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    style={({ pressed }) => [styles.iconButton, large && styles.bucketArrow, !large && { width: box, height: boxHeight }, (pressed || disabled) && { opacity: 0.4 }]} onPress={onPress}>
    <Feather name={icon} size={size ?? (large ? 36 : 23)} color={colors.ink} />
  </Pressable>;
}
function Action({ text, onPress, disabled = false, icon }: { text: string; onPress: () => void; disabled?: boolean; icon?: IconName }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    onPress={onPress} style={({ pressed }) => [styles.action, icon && styles.actionWithIcon, (disabled || pressed) && { opacity: 0.4 }]}>
    {icon && <Feather name={icon} size={20} color={colors.ink} />}<Text style={[styles.actionText, icon && styles.actionIconText]}>{text}</Text>
  </Pressable>;
}

export default function CollectionScreen() {
  const { width, height } = useWindowDimensions();
  const [screenSize, setScreenSize] = useState({ width, height });
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
  const [catalogInput, setCatalogInput] = useState<CatalogSource | null>(null);
  const [catalogImportedAt, setCatalogImportedAt] = useState('');
  const [catalogNotice, setCatalogNotice] = useState('');
  const [exportSummary, setExportSummary] = useState<{ total: number; newRecords: number; filename: string } | null>(null);
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
    const priority = bucket ? await store.current!.getPriority(nextProfile, bucket) : false;
    await store.current!.setSetting('activeBucket', bucket);
    validationRef.current = null; setValidation('');
    show({ profile: nextProfile, catalog, bucket, drafts, priority });
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
      setCatalogInput(await storage.setting<CatalogSource | null>('catalogInput', null));
      setCatalogImportedAt(await storage.setting('catalogImportedAt', ''));
      if (!profile.userName) { setEdit(''); setPanel('user'); }
      else if (!catalog.length) setPanel('settings');
    })().catch(e => { if (active) setFatal(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, retry]);

  function persist(next: Context, datesSelected = false) {
    if (!next.profile.userName || !next.bucket || !next.drafts.length || !store.current) return;
    const version = ++revision.current;
    const snapshot = { ...next, drafts: next.drafts.map(r => ({ ...r })) };
    queue.current!.enqueue(async () => {
      const error = await store.current!.saveSheet(snapshot.profile, snapshot.bucket, snapshot.drafts,
        snapshot.catalog.filter(e => e.block === snapshot.profile.block && e.cycle === snapshot.profile.cycle).map(e => e.bucket),
        datesSelected ? sheetDates(snapshot.drafts) : undefined, true);
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
    catch (e) { Alert.alert('Crossing Block', message(e)); }
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
      const current = contextRef.current!;
      await reload(profile, current.catalog, profile.userId === current.profile.userId && current.profile.userName ? current.bucket : undefined);
      setUsers(await store.current!.users()); setPanel(!current.catalog.length ? 'settings' : null);
    });
  }
  async function navigate(bucket: string) {
    await run(async () => {
      const current = contextRef.current!; await reload(current.profile, current.catalog, bucket); setPanel(null);
    });
  }
  async function togglePriority() {
    await run(async () => {
      await queue.current!.flush();
      const current = contextRef.current!;
      const priority = !current.priority;
      await store.current!.setPriority(current.profile, current.bucket, priority);
      show({ ...current, priority });
    }, false);
  }
  function deleteUser(user: User) {
    Alert.alert('Excluir usuário?', `${user.userName} será removido da lista. As coletas anteriores continuarão no aparelho e no CSV.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void run(async () => {
        const current = contextRef.current!;
        const profile = await store.current!.deleteUser(user.userId);
        await reload(profile, current.catalog, profile.userId === current.profile.userId ? current.bucket : undefined);
        setUsers(await store.current!.users()); setEdit(''); setPanel('user');
      }) },
    ]);
  }
  async function importCatalog(update = false) {
    await run(async () => {
      setCatalogNotice('');
      const result = update && catalogInput ? await reloadCatalog(catalogInput) : update ? null : await selectCatalog();
      if (!result) return;
      const entries = await store.current!.replaceCatalog(result.entries, result.filename, result.source);
      setCatalogInput(result.source);
      setCatalogImportedAt(await store.current!.setting('catalogImportedAt', ''));
      setCatalogNotice(update ? 'Cadastro atualizado. Avaliações preservadas.' : 'Cadastro importado.');
      const current = contextRef.current!;
      await reload(current.profile, entries, current.bucket); setSource(result.filename);
    });
  }
  async function confirmNewBlock() {
    await run(async () => {
      // Drain all writes before clearing; a draft validation error does not prevent an explicit reset.
      await queue.current!.flush().catch(() => {});
      const profile = await startNewBlock(store.current!, clearInternalCollectionFiles);
      revision.current++;
      queue.current = new SaveQueue((count, error) => { setPending(count); setSaveError(error ? message(error) : ''); });
      validationRef.current = null; setValidation(''); setSaveError(''); setPending(0);
      setSource('Nenhum arquivo importado'); setCatalogInput(null); setCatalogImportedAt(''); setCatalogNotice(''); setTarget(null); setExportSummary(null);
      setRowId(null); setDateRow(null); setEdit('');
      await reload(profile, []);
      setUsers(await store.current!.users());
      setPanel(profile.userName ? 'settings' : 'user');
    }, false);
  }
  async function selectOutput(kind: 'folder' | 'create' | 'open') {
    await run(async () => {
      const profile = contextRef.current!.profile;
      if (!profile.userName) throw new Error('Escolha o usuário no ícone superior esquerdo.');
      const selected = await chooseOutput(profile, kind); if (!selected) return;
      await store.current!.setSetting('outputDevice', selected);
      if (selected.kind === 'folder') await store.current!.setSetting('outputFolder', selected);
      setTarget(selected);
      setPanel('settings');
    });
  }
  async function exportCurrent() {
    await run(async () => {
      const current = contextRef.current!;
      if (!current.profile.userName) { openPanel('user'); return; }
      if (!target) { setPanel('settings'); Alert.alert('Destino do CSV', 'Escolha a pasta ou o arquivo de saída. Depois toque no ícone de exportação.'); return; }
      const summary = await exportDevice(store.current!, current.profile, records => exportCsv(current.profile, records, target));
      await reload(current.profile, current.catalog);
      setExportSummary({ ...summary, filename: exportFilename(current.profile) });
      setPanel('export-result');
      setNotice('CSV atualizado · nova coleta');
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
      const next = { ...current, drafts: changeSheetDate(current.drafts, id, date, await store.current!.all(), current.profile, current.bucket, true) };
      show(next); persist(next, true);
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
  const { profile, catalog, bucket, drafts, priority } = context;
  const buckets = catalog.filter(e => e.block === profile.block && e.cycle === profile.cycle).map(e => e.bucket);
  const bucketIndex = buckets.indexOf(bucket);
  const blocks = [...new Map(catalog.map(e => [JSON.stringify([e.cycle, e.block]), e])).values()];
  const layout = collectionLayout(screenSize.width, screenSize.height);
  const issue = saveError || validation;
  const title = panel === 'user' ? 'Usuário' : panel === 'settings' ? 'Configurações' : panel === 'new-block' ? 'Iniciar novo bloco?' : panel === 'export-result' ? 'Exportação concluída' : panel === 'output' ? 'Destino do CSV' : panel === 'block' ? 'Bloco de cruzamento' : panel === 'bucket' ? 'Escolher balde' : panel === 'quantity' ? 'Espigas' : 'Observação';
  const available = buckets.filter(b => !edit || b.includes(edit.trim())).slice(0, 120);

  return <SafeAreaView style={styles.root}>
    <View style={styles.screen} onLayout={event => {
      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
      setScreenSize(previous => previous.width === nextWidth && previous.height === nextHeight ? previous : { width: nextWidth, height: nextHeight });
    }}>
      <View style={[styles.collectionHeader, { height: layout.header }]}>
        <View style={styles.headerTools}>
          <IconButton icon="user" size={layout.headerIcon} box={layout.topButton} label={`Usuário: ${profile.userName || 'Escolher'}`} disabled={busy} onPress={() => openPanel('user')} />
          <IconButton icon="settings" size={layout.headerIcon} box={layout.topButton} label="Configurações" disabled={busy} onPress={() => openPanel('settings')} />
          <IconButton icon="upload" size={layout.headerIcon} box={layout.topButton} label="Exportar CSV" disabled={busy} onPress={() => void exportCurrent()} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Escolher bloco: ${profile.block}`} disabled={busy} style={[styles.block, { height: layout.topButton, left: layout.topButton + 8 }]} onPress={() => openPanel('block')}>
          <Text numberOfLines={1} style={[styles.blockName, { fontSize: layout.font - 1 }]}>{profile.block || 'Escolher BC'}</Text><Feather name="chevron-down" size={18} color={colors.ink} />
        </Pressable>
        <View style={[styles.bucketNav, { position: 'absolute', top: layout.topButton, height: layout.bucket, left: layout.topButton, right: layout.topButton, gap: 4 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Balde ${bucket || 'não selecionado'}. Escolher balde`} disabled={busy} style={styles.bucketChoice} onPress={() => openPanel('bucket')}>
            <Text maxFontSizeMultiplier={1.1} style={[styles.bucketLabel, { fontSize: layout.font - 3 }]}>BALDE</Text><Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15} style={[styles.bucketNumber, { fontSize: layout.bucketFont }]}>{bucket || '—'}</Text>
          </Pressable>
        </View>
        {!!bucket && <View style={[styles.headerPriority, { top: layout.topButton + layout.bucket, height: layout.priority, left: layout.topButton, right: layout.topButton }]}>
          <Pressable accessibilityRole="switch" accessibilityLabel={`Prioridade do balde ${bucket}`}
            accessibilityState={{ checked: priority, disabled: busy }} disabled={busy} onPress={() => void togglePriority()}
            style={({ pressed }) => [styles.priorityControl, { minHeight: layout.priority }, (pressed || busy) && { opacity: 0.4 }]}>
            <Text maxFontSizeMultiplier={1.1} style={[styles.priorityText, { fontSize: layout.font - 2 }]}>Prioridade</Text>
            <View style={[styles.priorityTrack, priority && styles.priorityOn]}><View style={styles.priorityKnob} /></View>
            <Text maxFontSizeMultiplier={1.1} style={[styles.priorityState, { fontSize: layout.font - 2 }]}>{priority ? 'Ligado' : 'Desligado'}</Text>
          </Pressable>
        </View>}
      </View>
      {drafts.length ? <View style={[styles.groups, { gap: layout.groupGap }, layout.horizontal && styles.horizontal]}>
        {(['EMASC', 'POLI'] as const).map(purpose => {
          const name = purpose === 'EMASC' ? 'Emasculação' : 'Polinização';
          const rows = drafts.filter(r => r.purpose === purpose).slice(0, VISIBLE_ROWS);
          return <View key={purpose} style={[styles.group, { gap: layout.gap, paddingTop: layout.gap }]}>
            <View style={[styles.groupHeading, { height: layout.heading }]}>
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit style={[styles.groupTitle, { fontSize: layout.titleFont }]}>{name}</Text>
            </View>
            <View style={[styles.rowLabels, { height: layout.labels }]}>
              <Text style={[styles.label, styles.equalColumn, { fontSize: layout.font - 2 }]}>Data</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, styles.equalColumn, { fontSize: layout.font - 2 }]}>Observação</Text>
              <Text style={[styles.label, styles.equalColumn, { fontSize: layout.font - 2 }]}>Espigas</Text>
            </View>
            {rows.map(row => <View key={row.rowId} style={[styles.row, { height: layout.rowHeight }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Data ${name}: ${row.date ? displayDate(row.date) : 'Escolher'}`} disabled={busy} style={[styles.field, styles.equalColumn]} onPress={() => setDateRow(row.rowId)}>
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit style={[styles.fieldText, { fontSize: layout.fieldFont }]}>{row.date ? displayDate(row.date).slice(0, 6) + row.date.slice(2, 4) : '—'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Observação ${name}: ${row.observation || 'Selecionar ou digitar'}`} disabled={busy} style={[styles.field, styles.equalColumn, styles.observation]} onPress={() => openPanel('observation', row)}>
                <Text numberOfLines={1} style={[styles.observationText, { fontSize: layout.fieldFont }]}>{row.observation || '—'}</Text><Feather name="chevron-down" size={14} color={colors.ink} />
              </Pressable>
              <View style={[styles.equalColumn, styles.counter]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Editar espigas ${name}: ${row.quantity}`} disabled={busy} style={styles.quantity} onPress={() => openPanel('quantity', row)}>
                  <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit style={[styles.quantityText, { fontSize: layout.fieldFont + 3 }]}>{row.quantity || '—'}</Text>
                </Pressable>
                <View style={styles.counterArrows}>
                  <IconButton icon="arrow-up" size={Math.min(32, Math.floor(layout.rowHeight / 2) - 2)} boxHeight={(layout.rowHeight - 2) / 2} label={`Somar espigas ${name} ${row.date}`} disabled={busy || Number(row.quantity) >= MAX_QUANTITY} onPress={() => step(row, 1)} />
                  <IconButton icon="arrow-down" size={Math.min(32, Math.floor(layout.rowHeight / 2) - 2)} boxHeight={(layout.rowHeight - 2) / 2} label={`Diminuir espigas ${name} ${row.date}`} disabled={busy || Number(row.quantity) <= 0} onPress={() => step(row, -1)} />
                </View>
              </View>
            </View>)}
          </View>;
        })}
      </View> : <View style={styles.center}><Action text="Importar cadastro de baldes" disabled={busy} onPress={() => openPanel('settings')} /></View>}
      {!!bucket && <View style={[styles.bottomNav, { height: layout.footer }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Balde anterior, navegação inferior" accessibilityState={{ disabled: busy || bucketIndex <= 0 }} disabled={busy || bucketIndex <= 0} onPress={() => void navigate(buckets[bucketIndex - 1])} style={({ pressed }) => [styles.bottomButton, { minHeight: layout.footer }, (pressed || busy || bucketIndex <= 0) && { opacity: 0.4 }]}>
          <Feather name="chevron-left" size={32} color={colors.ink} /><Text style={[styles.actionText, { fontSize: layout.footerFont }]}>Anterior</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo balde, navegação inferior" accessibilityState={{ disabled: busy || bucketIndex < 0 || bucketIndex >= buckets.length - 1 }} disabled={busy || bucketIndex < 0 || bucketIndex >= buckets.length - 1} onPress={() => void navigate(buckets[bucketIndex + 1])} style={({ pressed }) => [styles.bottomButton, { minHeight: layout.footer }, (pressed || busy || bucketIndex < 0 || bucketIndex >= buckets.length - 1) && { opacity: 0.4 }]}>
          <Text style={[styles.actionText, { fontSize: layout.footerFont }]}>Próximo</Text><Feather name="chevron-right" size={32} color={colors.ink} />
        </Pressable>
      </View>}
      <Pressable disabled={!issue || busy} onPress={() => void run(async () => {}, true)} accessibilityRole={issue ? 'button' : undefined} style={[styles.status, { height: layout.status, minHeight: layout.status, paddingTop: 0 }]}>
        {pending || busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Feather name={issue ? 'alert-circle' : 'check-circle'} size={14} color={issue ? colors.red : colors.green} />}
        <Text accessibilityLiveRegion="polite" numberOfLines={1} style={[styles.statusText, { fontSize: layout.font - 4 }, issue && { color: colors.red }]}>{issue ? `${issue} Toque para tentar novamente.` : pending ? 'Gravando no aparelho…' : notice || `${profile.userName || 'Escolha o usuário'} · No aparelho`}</Text>
      </Pressable>
    </View>

    {dateRow && <DateTimePicker value={new Date(`${drafts.find(r => r.rowId === dateRow)?.date || today()}T12:00:00`)} mode="date" minimumDate={new Date(2000, 0, 1)} maximumDate={new Date(2100, 11, 31)} onChange={(event, date) => { const id = dateRow; setDateRow(null); if (event.type === 'set' && date) void pickDate(id, today(date)); }} />}
    <Modal visible={!!panel} transparent animationType="fade" onRequestClose={() => { if (!busy && (panel !== 'user' || profile.userName)) setPanel(panel === 'output' || panel === 'new-block' ? 'settings' : null); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><IconButton icon="x" label="Fechar" disabled={busy || (panel === 'user' && !profile.userName)} onPress={() => setPanel(panel === 'output' || panel === 'new-block' ? 'settings' : null)} /></View>
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
              {panel === 'new-block' && <>
                <Text style={styles.hint}>Esta ação apaga os dados salvos deste aplicativo no aparelho:</Text>
                <Text style={styles.hint}>{'• Todas as coletas e o histórico de avaliações, de todos os usuários.\n• Prioridades e cadastro de baldes.\n• Datas, espigas, observações, cópias internas do CSV e arquivos temporários.\n• Locais de entrada e saída que estavam salvos.'}</Text>
                <Text style={styles.hint}>O arquivo original de baldes e os CSVs já exportados não serão excluídos.</Text>
                <Text style={styles.resetWarning}>A limpeza não pode ser desfeita. Exporte seus dados e confira a sincronização no OneDrive antes de continuar.</Text>
                <View style={styles.dialogActions}>
                  <View style={styles.dialogAction}><Action disabled={busy} text="Cancelar" onPress={() => setPanel('settings')} /></View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Limpar e iniciar novo bloco" accessibilityState={{ disabled: busy }} disabled={busy}
                    onPress={() => void confirmNewBlock()} style={({ pressed }) => [styles.primaryAction, (busy || pressed) && { opacity: 0.4 }]}>
                    <Text style={styles.primaryActionText}>Limpar e iniciar</Text>
                  </Pressable>
                </View>
              </>}
              {panel === 'export-result' && exportSummary && <>
                <Text style={styles.hint}>O CSV foi atualizado.</Text>
                <Text style={styles.filename}>{exportSummary.filename}</Text>
                <View style={styles.exportTotal}><Text style={styles.exportLabel}>Total de registros no arquivo</Text><Text style={styles.exportCount}>{exportSummary.total.toLocaleString('pt-BR')}</Text></View>
                <View style={styles.exportTotal}><Text style={styles.exportLabel}>Novos desde a última exportação</Text><Text style={styles.exportCount}>{exportSummary.newRecords.toLocaleString('pt-BR')}</Text></View>
                <Text style={styles.hint}>Confira no OneDrive se a sincronização do arquivo foi concluída.</Text>
                <Action disabled={busy} text="OK" onPress={() => setPanel(null)} />
              </>}
              {panel === 'settings' && <>
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsTitle}>Cadastro de baldes</Text>
                  <View style={styles.catalogButtons}>
                    <View style={styles.catalogButton}><Action disabled={busy} icon="folder" text="Escolher arquivo" onPress={() => void importCatalog()} /></View>
                    <View style={styles.catalogButton}><Action disabled={busy || !catalogInput} icon="refresh-cw" text="Atualizar" onPress={() => void importCatalog(true)} /></View>
                  </View>
                  <Text style={styles.filename}>{source}</Text>
                  {!!catalogImportedAt && <Text style={styles.hint}>Última importação: {new Date(catalogImportedAt).toLocaleString('pt-BR')}</Text>}
                  {!!catalogNotice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{catalogNotice}</Text>}
                </View>
                <View style={[styles.settingsSection, styles.settingsDivider]}>
                  <Text style={styles.settingsTitle}>Saída CSV</Text>
                  <Text style={styles.hint}>{target ? target.name : 'Destino não selecionado'}</Text>
                  <Action disabled={busy} text={target ? 'Alterar destino' : 'Escolher destino'} onPress={() => setPanel('output')} />
                </View>
                <View style={[styles.settingsSection, styles.settingsDivider]}>
                  <Text style={styles.settingsTitle}>Cópia dos dados</Text>
                  <Action disabled={busy} text="Enviar cópia dos dados" onPress={() => void sendCopy()} />
                  <Text style={styles.hint}>Enviar uma cópia não limpa a coleta.</Text>
                </View>
                <View style={[styles.settingsSection, styles.settingsDivider]}>
                  <Text style={styles.settingsTitle}>Bloco de cruzamento</Text>
                  <Action disabled={busy} text="Iniciar novo bloco de cruzamento" onPress={() => setPanel('new-block')} />
                  <Text style={styles.hint}>Limpa os dados locais e redefine os locais dos arquivos.</Text>
                </View>
              </>}
              {panel === 'output' && <>
                <Text style={styles.hint}>O destino será lembrado neste aparelho.</Text>
                {!!profile.userName && <Text style={styles.filename}>{exportFilename(profile)}</Text>}
                <Action disabled={busy} text="Escolher pasta de saída" onPress={() => void selectOutput('folder')} />
                <Action disabled={busy} text="Criar arquivo de saída" onPress={() => void selectOutput('create')} />
                <Action disabled={busy} text="Escolher CSV existente" onPress={() => void selectOutput('open')} />
                <Text style={styles.hint}>OneDrive não aparece? Use Enviar cópia dos dados nas configurações.</Text>
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
  collectionHeader: { position: 'relative', flexShrink: 0 },
  headerTools: { position: 'absolute', left: 0, top: 0 },
  headerPriority: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  catalogButtons: { flexDirection: 'row', gap: 10 }, catalogButton: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  block: { position: 'absolute', right: 0, top: 0, minWidth: 0, minHeight: 44, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'flex-end' },
  blockName: { flexShrink: 1, color: colors.ink, fontWeight: '700', fontSize: 15 },
  bucketNav: { height: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 2 },
  bucketArrow: { width: 56, height: 56 },
  bucketChoice: { flexShrink: 1, minWidth: 70, alignItems: 'center', justifyContent: 'center' }, bucketLabel: { fontSize: 11, color: colors.muted, letterSpacing: 1 },
  bucketNumber: { fontSize: 35, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  priorityControl: { minHeight: 44, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityText: { fontSize: 12, color: colors.ink }, priorityState: { fontSize: 11, color: colors.ink },
  priorityTrack: { width: 50, height: 30, borderRadius: 12, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.paper, padding: 2, justifyContent: 'center', alignItems: 'flex-start' },
  priorityOn: { backgroundColor: '#b4bd00', alignItems: 'flex-end' },
  priorityKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink },
  groups: { flex: 1 }, horizontal: { flexDirection: 'row' },
  group: { flex: 1, minWidth: 0, borderTopWidth: 1, borderColor: colors.line },
  groupHeading: { flexDirection: 'row', alignItems: 'center' },
  rowControls: { width: 88, flexDirection: 'row' }, headingBalance: { width: 88 },
  equalColumn: { flex: 1, minWidth: 0 },
  counterArrows: { alignItems: 'center', justifyContent: 'center' },
  bottomNav: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  bottomButton: { flex: 1, minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  groupTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700', color: colors.ink },
  rowLabels: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 20 }, label: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  dateColumn: { flex: 1, minWidth: 66 }, countColumn: { width: 132 }, obsColumn: { flex: 0.85, minWidth: 66 },
  field: { height: '100%', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  fieldText: { fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  counter: { flexDirection: 'row', height: '100%', backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line, borderRadius: 8, alignItems: 'center' },
  quantity: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'center', alignItems: 'center' },
  quantityText: { fontSize: 18, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  observation: { flexDirection: 'row', gap: 2, justifyContent: 'space-between' }, observationText: { flex: 1, fontSize: 12, color: colors.ink },
  status: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6 }, statusText: { flex: 1, fontSize: 11, color: colors.green },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 14 },
  modalSafe: { maxHeight: '100%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  modalCard: { maxHeight: '100%', backgroundColor: colors.paper, borderRadius: 18, padding: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { flex: 1, fontSize: 20, color: colors.ink, fontWeight: '700' }, modalContent: { gap: 12, paddingBottom: 10 },
  action: { minHeight: 44, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.field, justifyContent: 'center' },
  actionWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8 }, actionIconText: { flexShrink: 1 },
  actionText: { fontSize: 15, color: colors.ink }, hint: { fontSize: 13, lineHeight: 19, color: colors.muted }, filename: { fontSize: 13, color: colors.ink },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top' }, largeInput: { fontSize: 30, textAlign: 'center' },
  bucketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resetWarning: { fontSize: 13, lineHeight: 20, color: colors.ink, fontWeight: '600', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  dialogActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, dialogAction: { flex: 1, minWidth: 110 },
  primaryAction: { flex: 1, minWidth: 130, minHeight: 44, borderRadius: 8, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 10 },
  primaryActionText: { fontSize: 15, color: colors.paper, fontWeight: '600' },
  exportTotal: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 12 },
  exportLabel: { flex: 1, color: colors.ink, fontSize: 14 }, exportCount: { color: colors.ink, fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  settingsSection: { gap: 8 }, settingsTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  settingsDivider: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 },
});
