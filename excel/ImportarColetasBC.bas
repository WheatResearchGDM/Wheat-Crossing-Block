Attribute VB_Name = "ImportarColetasBC"
Option Explicit

' Initial integration module. Validate in a COPY of the production workbook first.
' No external reference required: dictionaries are late-bound.
Private Const BASE As String = "APP_COLETAS"
Private Const TARGET As String = "DISPONIBILIDADE"

Private Function Headers() As Variant
    Headers = Split("schema_version;record_id;version;cycle;block;bucket;date;purpose;quantity;observation;user_id;user_name;device_id;created_at;updated_at", ";")
End Function

' Pure smoke test: no file dialogs, file access or production worksheet changes.
Public Function AutotesteBC() As String
    Dim history As Object, row As Variant
    Set history = Dict()
    row = Array("1", "teste", "1", "2026", "BC1", "1250", "2026-10-24", "EMASC", "0", _
        "observacao; com delimitador", "usuario", "Coletor", "aparelho", "2026-10-24T10:00:00.000Z", "2026-10-24T10:00:00.000Z")
    MergeRow history, row: MergeRow history, row
    If history.Count <> 1 Then StopImport "Falha ao deduplicar."
    row(2) = "2": row(8) = "12"
    MergeRow history, row
    If history.Count <> 2 Then StopImport "Falha ao preservar revisao."
    If Format$(IsoDate("2028-02-29"), "yyyy-mm-dd") <> "2028-02-29" Then StopImport "Falha de data."
    AutotesteBC = "OK: deduplicacao, revisao, zero e data."
End Function

Private Sub StopImport(ByVal reason As String)
    Err.Raise vbObjectError + 151, "ImportarColetasBC", reason
End Sub

Private Function Dict() As Object
    Set Dict = CreateObject("Scripting.Dictionary")
    Dict.CompareMode = vbBinaryCompare
End Function

Private Function Sheet(ByVal name As String, Optional ByVal create As Boolean = False) As Worksheet
    On Error Resume Next
    Set Sheet = ThisWorkbook.Worksheets(name)
    On Error GoTo 0
    If Sheet Is Nothing And create Then
        Set Sheet = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        Sheet.name = name
    End If
End Function

Private Function IsoDate(ByVal value As String) As Date
    Dim result As Date
    If Not value Like "####-##-##" Then StopImport "Data invalida: " & value
    result = DateSerial(CInt(Left$(value, 4)), CInt(Mid$(value, 6, 2)), CInt(Right$(value, 2)))
    If Format$(result, "yyyy-mm-dd") <> value Then StopImport "Data inexistente: " & value
    If Year(result) < 2000 Or Year(result) > 2100 Then StopImport "Data fora do intervalo 2000-2100."
    IsoDate = result
End Function

Private Function IsIntegerText(ByVal value As String) As Boolean
    IsIntegerText = (Len(value) > 0 And Not value Like "*[!0-9]*")
End Function

Private Sub ValidateRow(ByVal row As Variant)
    Dim ignored As Date, i As Long
    If row(0) <> "1" Then StopImport "Versao de CSV nao suportada."
    If Len(row(1)) = 0 Then StopImport "Registro sem identificador."
    If Not IsIntegerText(row(2)) Then StopImport "Versao de registro invalida."
    If CDbl(row(2)) < 1 Or CDbl(row(2)) > 2147483647# Then StopImport "Versao de registro fora do intervalo."
    For i = 3 To 4
        If Len(Trim$(row(i))) = 0 Or Len(row(i)) > 80 Then StopImport "Safra ou bloco invalido."
    Next i
    If Not IsIntegerText(row(5)) Or Len(row(5)) > 8 Then StopImport "Numero de balde invalido."
    ignored = IsoDate(CStr(row(6)))
    If row(7) <> "EMASC" And row(7) <> "POLI" Then StopImport "Finalidade invalida."
    If Not IsIntegerText(row(8)) Then StopImport "Quantidade invalida."
    If CDbl(row(8)) > 100000 Then StopImport "Quantidade acima de 100000."
    If Len(row(9)) > 500 Then StopImport "Observacao acima de 500 caracteres."
    For i = 10 To 14
        If Len(row(i)) = 0 Then StopImport "Registro sem autoria, aparelho ou horario."
    Next i
End Sub

Private Function RowValues(ByVal source As Worksheet, ByVal r As Long) As Variant
    Dim result(0 To 14) As String, c As Long
    For c = 0 To 14
        If IsError(source.Cells(r, c + 1).Value2) Then StopImport "Celula com erro na linha " & r
        result(c) = CStr(source.Cells(r, c + 1).Value2)
    Next c
    RowValues = result
End Function

Private Sub MergeRow(ByVal history As Object, ByVal row As Variant)
    Dim key As String, previous As Variant, i As Long
    ValidateRow row
    key = CStr(row(1)) & ":" & CStr(row(2))
    If history.Exists(key) Then
        previous = history(key)
        For i = 0 To 14
            If previous(i) <> row(i) Then StopImport "Mesmo identificador e versao com conteudos diferentes: " & key
        Next i
    Else
        history.Add key, row
    End If
End Sub

Private Sub ReadSheet(ByVal source As Worksheet, ByVal history As Object)
    Dim expected As Variant, i As Long, r As Long, last As Long
    expected = Headers()
    For i = 0 To 14
        If CStr(source.Cells(1, i + 1).Value2) <> expected(i) Then StopImport "Cabecalho CSV incompativel: " & source.name
    Next i
    If source.UsedRange.Columns.Count > 15 Then StopImport "O arquivo contem colunas adicionais."
    last = source.Cells(source.Rows.Count, 1).End(xlUp).Row
    For r = 2 To last
        MergeRow history, RowValues(source, r)
    Next r
End Sub

Private Sub ReadCsv(ByVal filename As String, ByVal history As Object)
    Dim info(0 To 14) As Variant, i As Long, source As Workbook, opened As Workbook
    Dim failure As String
    On Error GoTo Failed
    For Each opened In Application.Workbooks
        If StrComp(opened.FullName, filename, vbTextCompare) = 0 Then StopImport "Feche o CSV no Excel antes de importar: " & filename
    Next opened
    For i = 0 To 14
        info(i) = Array(i + 1, xlTextFormat)
    Next i
    Workbooks.OpenText filename:=filename, Origin:=65001, StartRow:=1, DataType:=xlDelimited, _
        TextQualifier:=xlTextQualifierDoubleQuote, ConsecutiveDelimiter:=False, Tab:=False, _
        Semicolon:=True, Comma:=False, Space:=False, Other:=False, FieldInfo:=info, Local:=False
    Set source = ActiveWorkbook
    ReadSheet source.Worksheets(1), history
    source.Close SaveChanges:=False
    Exit Sub
Failed:
    failure = Err.Description
    If Not source Is Nothing Then source.Close SaveChanges:=False
    StopImport filename & vbCrLf & failure
End Sub

Private Function LogicalKey(ByVal row As Variant) As String
    LogicalKey = Join(Array(row(3), row(4), row(5), row(6), row(7)), ChrW(30))
End Function

Private Sub WriteRows(ByVal name As String, ByVal rows As Object)
    Dim destination As Worksheet, values() As Variant, expected As Variant
    Dim key As Variant, row As Variant, r As Long, c As Long
    Set destination = Sheet(name, True)
    expected = Headers()
    ReDim values(1 To rows.Count + 1, 1 To 15)
    For c = 0 To 14
        values(1, c + 1) = expected(c)
    Next c
    r = 2
    For Each key In rows.Keys
        row = rows(key)
        For c = 0 To 14
            values(r, c + 1) = CStr(row(c))
        Next c
        r = r + 1
    Next key
    destination.Cells.ClearContents
    With destination.Range("A1").Resize(rows.Count + 1, 15)
        .NumberFormat = "@"
        .Value2 = values
    End With
    destination.Rows(1).Font.Bold = True
End Sub

Private Function Choices() As Object
    Dim source As Worksheet, result As Object, r As Long, row As Variant, values As Variant
    Set result = Dict(): Set source = Sheet("APP_ESCOLHAS", True)
    If Len(CStr(source.Cells(1, 1).Value2)) = 0 Then
        values = Array("cycle", "block", "bucket", "date", "purpose", "record_id")
        For r = 0 To 5
            source.Cells(1, r + 1).Value2 = values(r)
        Next r
        source.Columns("A:F").NumberFormat = "@"
    End If
    For r = 2 To source.Cells(source.Rows.Count, 1).End(xlUp).Row
        values = Array("", "", "", CStr(source.Cells(r, 1).Value2), CStr(source.Cells(r, 2).Value2), _
            CStr(source.Cells(r, 3).Value2), CStr(source.Cells(r, 4).Value2), CStr(source.Cells(r, 5).Value2))
        If Len(CStr(source.Cells(r, 6).Value2)) > 0 Then
            If result.Exists(LogicalKey(values)) Then StopImport "Escolha repetida em APP_ESCOLHAS."
            result.Add LogicalKey(values), CStr(source.Cells(r, 6).Value2)
        End If
    Next r
    Set Choices = result
End Function

Public Sub ImportarColetasBC()
    Dim wb As Workbook, grid As Worksheet, archive As Worksheet, context As Worksheet, report As Worksheet
    Dim picker As Object, history As Object, latest As Object, groups As Object, winners As Object
    Dim choicesMap As Object, bucketRows As Object, dateCols As Object, conflicts As Object
    Dim key As Variant, row As Variant, previous As Variant, ids As Collection, id As Variant
    Dim folder As String, filename As String, files As Collection, path As Variant
    Dim cycle As String, block As String, backup As String, logical As String, chosen As String
    Dim r As Long, c As Long, lastCol As Long, lastRow As Long, count As Long, colKey As String, label As String
    Dim oldEvents As Boolean, oldScreen As Boolean, oldAlerts As Boolean, failure As String
    Dim touched As Boolean, headerDate As Date, found As Range
    On Error GoTo Failed
    Set wb = ThisWorkbook: Set grid = Sheet(TARGET)
    If grid Is Nothing Then StopImport "A aba DISPONIBILIDADE nao existe neste arquivo."
    If wb.ReadOnly Or Len(wb.path) = 0 Then StopImport "Salve uma copia local editavel do XLSM antes de importar."
    If Not wb.Saved Then StopImport "Salve as alteracoes da planilha antes de importar."
    If grid.ProtectContents Then StopImport "A aba DISPONIBILIDADE esta protegida."
    Set context = Sheet("APP_CONTEXTO")
    If context Is Nothing Then
        cycle = Trim$(InputBox("Safra/ciclo correspondente a esta planilha:"))
        If Len(cycle) = 0 Then Exit Sub
        block = Trim$(InputBox("Bloco correspondente a esta planilha (igual ao aplicativo):"))
        If Len(block) = 0 Then Exit Sub
    Else
        cycle = CStr(context.Cells(2, 1).Value2): block = CStr(context.Cells(2, 2).Value2)
        If Len(cycle) = 0 Or Len(block) = 0 Then StopImport "APP_CONTEXTO sem safra/bloco."
    End If
    Set picker = Application.FileDialog(4)
    picker.Title = "Pasta contendo os arquivos coletas_*.csv"
    If picker.Show <> -1 Then Exit Sub
    folder = picker.SelectedItems(1)
    Set files = New Collection
    filename = Dir(folder & Application.PathSeparator & "coletas_*.csv")
    Do While Len(filename) > 0
        files.Add folder & Application.PathSeparator & filename
        filename = Dir()
    Loop
    If files.Count = 0 Then StopImport "Nenhum arquivo coletas_*.csv encontrado."
    Set history = Dict(): Set latest = Dict(): Set groups = Dict(): Set winners = Dict()
    Set conflicts = Dict(): Set bucketRows = Dict(): Set dateCols = Dict()
    oldEvents = Application.EnableEvents: oldScreen = Application.ScreenUpdating: oldAlerts = Application.DisplayAlerts
    touched = True
    Application.EnableEvents = False: Application.ScreenUpdating = False: Application.DisplayAlerts = False
    Set archive = Sheet(BASE)
    If Not archive Is Nothing Then ReadSheet archive, history
    For Each path In files
        ReadCsv CStr(path), history
    Next path
    For Each key In history.Keys
        row = history(key)
        If latest.Exists(row(1)) Then
            previous = latest(row(1))
            For Each id In Array(3, 4, 5, 6, 7, 10, 12, 13)
                If previous(id) <> row(id) Then StopImport "A identidade de um registro foi alterada: " & row(1)
            Next id
            If CLng(row(2)) > CLng(previous(2)) Then latest(row(1)) = row
        Else
            latest.Add row(1), row
        End If
    Next key
    For Each key In latest.Keys
        row = latest(key)
        If row(3) = cycle And row(4) = block Then
            logical = LogicalKey(row)
            If Not groups.Exists(logical) Then
                Set ids = New Collection: groups.Add logical, ids
            End If
            groups(logical).Add CStr(key)
        End If
    Next key
    If groups.Count = 0 Then StopImport "Nenhuma coleta corresponde a safra/bloco: " & cycle & " / " & block
    backup = wb.path & Application.PathSeparator & "backup_app_" & Format$(Now, "yyyymmdd_hhnnss") & "_" & Format$(Timer * 100, "0") & ".xlsm"
    wb.SaveCopyAs backup
    Set choicesMap = Choices()
    For Each key In groups.Keys
        Set ids = groups(key): chosen = ""
        If ids.Count = 1 Then
            chosen = ids(1)
        Else
            If choicesMap.Exists(key) Then
                For Each id In ids
                    If id = choicesMap(key) Then chosen = id
                Next id
            End If
            If Len(chosen) = 0 Then
                For Each id In ids
                    conflicts.Add CStr(id), latest(id)
                Next id
            End If
        End If
        If Len(chosen) > 0 Then winners.Add CStr(key), latest(chosen)
    Next key
    If conflicts.Count > 0 Then
        WriteRows BASE, history: WriteRows "APP_CONFLITOS", conflicts
        wb.Save
        MsgBox "A DISPONIBILIDADE nao foi alterada. Consulte APP_CONFLITOS e preencha APP_ESCOLHAS com o record_id escolhido para cada divergencia. Depois execute novamente." & vbCrLf & "Backup: " & backup, vbExclamation
        GoTo Done
    End If
    lastRow = grid.Cells(grid.Rows.Count, 2).End(xlUp).Row
    For r = 3 To lastRow
        label = CStr(grid.Cells(r, 2).Value2)
        If Len(label) > 0 Then
            If bucketRows.Exists(label) Then StopImport "Balde repetido em DISPONIBILIDADE: " & label
            bucketRows.Add label, r
        End If
    Next r
    Set found = grid.Cells.Find(What:="*", LookIn:=xlFormulas, SearchOrder:=xlByColumns, SearchDirection:=xlPrevious)
    lastCol = 2
    If Not found Is Nothing Then lastCol = found.Column
    For c = 3 To lastCol
        label = UCase$(Trim$(CStr(grid.Cells(2, c).Value2)))
        If label = "EMASC" Or label = "POLI" Then
            If Not IsNumeric(grid.Cells(1, c).Value2) Then StopImport "Cabecalho de data invalido na coluna " & c
            headerDate = CDate(CDbl(grid.Cells(1, c).Value2))
            If wb.Date1904 Then headerDate = headerDate + 1462
            colKey = Format$(headerDate, "yyyy-mm-dd") & "|" & label
            If dateCols.Exists(colKey) Then StopImport "Data/finalidade repetida no cabecalho: " & colKey
            dateCols.Add colKey, c
        End If
    Next c
    For Each key In winners.Keys
        row = winners(key)
        If Not bucketRows.Exists(row(5)) Then StopImport "Balde ausente na planilha: " & row(5)
        colKey = row(6) & "|" & row(7)
        If Not dateCols.Exists(colKey) Then
            lastCol = lastCol + 1
            If lastCol > grid.Columns.Count Then StopImport "Limite de colunas atingido."
            dateCols.Add colKey, lastCol
        End If
        If grid.Cells(1, dateCols(colKey)).HasFormula Or grid.Cells(2, dateCols(colKey)).HasFormula Then StopImport "Um cabecalho de destino contem formula. Importacao interrompida."
        If grid.Cells(bucketRows(row(5)), dateCols(colKey)).HasFormula Then StopImport "Uma celula de destino contem formula. Importacao interrompida."
    Next key
    Application.ScreenUpdating = oldScreen
    If MsgBox(winners.Count & " avaliacoes serao aplicadas em " & cycle & " / " & block & ". Valores nas celulas correspondentes serao substituidos. Continuar?", vbYesNo + vbQuestion) <> vbYes Then GoTo Done
    Application.ScreenUpdating = False
    For Each key In winners.Keys
        row = winners(key): colKey = row(6) & "|" & row(7): c = dateCols(colKey)
        grid.Cells(1, c).Value = IsoDate(CStr(row(6)))
        grid.Cells(1, c).NumberFormat = "dd/mm/yyyy"
        grid.Cells(2, c).Value2 = IIf(row(7) = "EMASC", "Emasc", "Poli")
        grid.Cells(bucketRows(row(5)), c).Value2 = CLng(row(8))
        count = count + 1
    Next key
    WriteRows BASE, history
    Set report = Sheet("APP_CONFLITOS")
    If Not report Is Nothing Then report.Cells.ClearContents
    Set context = Sheet("APP_CONTEXTO", True)
    context.Columns("A:B").NumberFormat = "@"
    context.Cells(1, 1).Value2 = "cycle": context.Cells(1, 2).Value2 = "block"
    context.Cells(2, 1).Value2 = cycle: context.Cells(2, 2).Value2 = block
    grid.Calculate
    wb.Save
    MsgBox count & " avaliacoes aplicadas. Observacoes e versoes preservadas em APP_COLETAS." & vbCrLf & "Backup: " & backup, vbInformation
Done:
    If touched Then
        Application.EnableEvents = oldEvents: Application.ScreenUpdating = oldScreen: Application.DisplayAlerts = oldAlerts
    End If
    Exit Sub
Failed:
    failure = Err.Description
    If touched Then
        Application.EnableEvents = oldEvents: Application.ScreenUpdating = oldScreen: Application.DisplayAlerts = oldAlerts
    End If
    MsgBox "Importacao interrompida: " & failure & vbCrLf & "Se houver erro apos o inicio das gravacoes, feche sem salvar e use o backup indicado abaixo." & vbCrLf & backup, vbCritical
End Sub
