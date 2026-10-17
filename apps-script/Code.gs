const CONFIG = Object.freeze({
  APP_TITLE: 'JS Market | Muestreo PDV',
  PUBLIC_APP_URL: 'https://claudiowebs.github.io/js-market-solutions/',
  SPREADSHEET_NAME: 'Muestreo Clientes PDV - DB',
  AUDIO_FOLDER_NAME: 'Muestreo Clientes PDV - Audios',
  TIMEZONE: 'America/Lima',
  MAX_AUDIO_BYTES: 25 * 1024 * 1024,
  RECORDS: {
    SHEET: 'REGISTROS',
    HEADERS: ['ID', 'FECHA_REGISTRO', 'FECHA', 'DNI', 'COD_CLIENTE', 'NOMBRE_PUNTO', 'ZONAL', 'RUTA', 'MODULO', 'DISTRITO', 'AUDIO_FILE_ID', 'AUDIO_URL', 'ESTADO', 'TRANSCRIPCION', 'FECHA_TRANSCRIPCION', 'ERROR', 'DNI_JEFE_ZONAL', 'NOMBRE_JEFE_ZONAL', 'OBSERVACION'],
    KEYS: ['id', 'fechaRegistro', 'fecha', 'dni', 'codCliente', 'nombrePunto', 'zonal', 'ruta', 'modulo', 'distrito', 'audioFileId', 'audioUrl', 'estado', 'transcripcion', 'fechaTranscripcion', 'error', 'dniJefe', 'nombreJefe', 'observacion'],
  },
  CLIENTS: {
    SHEET: 'CLIENTES',
    SOURCE_FILE_ID: '1xVLNKQ3obwB_ddEWiXQ0h8UyL2jGY1gE',
    SOURCE_SHEET: 'DETALLE',
    KEYS: ['dni', 'codCliente', 'codigoCum', 'nombrePunto', 'zonal', 'ruta', 'modulo', 'distrito', 'direccion', 'dniJefe', 'nombreJefe'],
    PUBLIC_KEYS: ['dni', 'codCliente', 'codigoCum', 'nombrePunto', 'zonal', 'ruta', 'modulo', 'distrito', 'direccion'],
    SOURCE_HEADERS: {
      dni: 'CEDULA_CLIENTE',
      codCliente: 'COD CLIENTE',
      codigoCum: 'CODIGO_CUM',
      nombrePunto: 'NOMBRE_PUNTO',
      zonal: 'ZONAL',
      ruta: 'RUTA',
      modulo: 'MODULO',
      distrito: 'DISTRITO',
      direccion: 'DIRECCION',
      dniJefe: 'DNI_ZONAL',
      nombreJefe: 'NOMBRE_JEFE_ZONAL',
    },
  },
  ACCESS: {
    MAX_FAILED_ATTEMPTS: 20,
    LOCK_SECONDS: 900,
    FAIL_DELAY_MS: 1200,
  },
  STATUS: { AUDIO: 'CON_AUDIO', TEXT: 'SOLO_TEXTO', EMPTY: 'SIN_DATOS' },
  PROPS: {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    AUDIO_FOLDER_ID: 'AUDIO_FOLDER_ID',
    CLIENTS_SOURCE_ID: 'CLIENTES_FILE_ID',
    PUBLIC_APP_URL: 'PUBLIC_APP_URL',
  },
});

const API_ROUTES = Object.freeze({
  apiLogin: (dniJefe) => apiLogin(dniJefe),
  apiGetClientes: (dniJefe) => apiGetClientes(dniJefe),
  apiListRecords: (dniJefe) => apiListRecords(dniJefe),
  apiCreateRecord: (dniJefe, payload) => apiCreateRecord(dniJefe, payload),
  apiDeleteRecord: (dniJefe, id) => apiDeleteRecord(dniJefe, id),
  apiTranscribeAudio: (dniJefe, audio) => apiTranscribeAudio(dniJefe, audio),
});

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.config = JSON.stringify({
    publicUrl: PropertiesService.getScriptProperties().getProperty(CONFIG.PROPS.PUBLIC_APP_URL) || CONFIG.PUBLIC_APP_URL,
  });
  return template
    .evaluate()
    .setTitle(CONFIG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const route = API_ROUTES[request.action];
    if (!route) throw new Error('Acción no válida.');
    return jsonResponse_({ ok: true, data: route(...(request.args || [])) });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setup() {
  const props = PropertiesService.getScriptProperties();

  if (!props.getProperty(CONFIG.PROPS.SPREADSHEET_ID)) {
    const created = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    created.setSpreadsheetTimeZone(CONFIG.TIMEZONE);
    props.setProperty(CONFIG.PROPS.SPREADSHEET_ID, created.getId());
  }
  if (!props.getProperty(CONFIG.PROPS.AUDIO_FOLDER_ID)) {
    props.setProperty(CONFIG.PROPS.AUDIO_FOLDER_ID, DriveApp.createFolder(CONFIG.AUDIO_FOLDER_NAME).getId());
  }
  if (!props.getProperty(CONFIG.PROPS.CLIENTS_SOURCE_ID)) {
    props.setProperty(CONFIG.PROPS.CLIENTS_SOURCE_ID, CONFIG.CLIENTS.SOURCE_FILE_ID);
  }

  const sheet = Db.sheet(CONFIG.RECORDS.SHEET);
  sheet.getRange(1, 1, 1, CONFIG.RECORDS.HEADERS.length).setValues([CONFIG.RECORDS.HEADERS]).setFontWeight('bold');
  sheet.getRange(1, 1, sheet.getMaxRows(), CONFIG.RECORDS.HEADERS.length).setNumberFormat('@');
  sheet.setFrozenRows(1);

  const total = syncClientes();
  installSyncTrigger_();

  Logger.log('Spreadsheet: %s', Db.spreadsheet().getUrl());
  Logger.log('Carpeta audios: %s', DriveApp.getFolderById(props.getProperty(CONFIG.PROPS.AUDIO_FOLDER_ID)).getUrl());
  Logger.log('Clientes sincronizados: %s', total);
}

function syncClientes() {
  const sourceId = PropertiesService.getScriptProperties().getProperty(CONFIG.PROPS.CLIENTS_SOURCE_ID) || CONFIG.CLIENTS.SOURCE_FILE_ID;
  const rows = ClientSource.read(sourceId);
  const sheet = Db.sheet(CONFIG.CLIENTS.SHEET);
  const values = [CONFIG.CLIENTS.KEYS.map((k) => CONFIG.CLIENTS.SOURCE_HEADERS[k])].concat(rows);

  sheet.clearContents();
  sheet.getRange(1, 1, values.length, CONFIG.CLIENTS.KEYS.length).setNumberFormat('@').setValues(values);
  sheet.getRange(1, 1, 1, CONFIG.CLIENTS.KEYS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return rows.length;
}

function apiLogin(dniJefe) {
  const jefe = Access.authenticate(dniJefe);
  return { dniJefe: jefe.dniJefe, nombreJefe: jefe.nombreJefe, totalClientes: jefe.clients.length };
}

function apiGetClientes(dniJefe) {
  const jefe = Access.authenticate(dniJefe);
  return jefe.clients.map((c) => CONFIG.CLIENTS.PUBLIC_KEYS.map((key) => c[key]));
}

function apiListRecords(dniJefe) {
  const jefe = Access.authenticate(dniJefe);
  return RecordRepository.findByJefe(jefe.dniJefe);
}

function apiCreateRecord(dniJefe, payload) {
  const jefe = Access.authenticate(dniJefe);
  const input = Validator.record(payload);
  const client = jefe.clients.find((c) => c.dni === input.dni && c.codCliente === input.codCliente);
  if (!client) throw new Error('El cliente no pertenece a tu zonal.');

  const id = Utilities.getUuid();
  const now = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const transcripcion = Transcript.sanitize(payload.transcripcion);
  const audio = payload.audio ? AudioStorage.save(payload.audio, id) : null;

  RecordRepository.insert({
    id,
    fechaRegistro: now,
    fecha: input.fecha,
    dni: client.dni,
    codCliente: client.codCliente,
    nombrePunto: client.nombrePunto,
    zonal: client.zonal,
    ruta: client.ruta,
    modulo: client.modulo,
    distrito: client.distrito,
    audioFileId: audio ? audio.id : '',
    audioUrl: audio ? audio.url : '',
    estado: audio ? CONFIG.STATUS.AUDIO : input.observacion ? CONFIG.STATUS.TEXT : CONFIG.STATUS.EMPTY,
    transcripcion,
    fechaTranscripcion: transcripcion ? now : '',
    error: '',
    dniJefe: jefe.dniJefe,
    nombreJefe: jefe.nombreJefe,
    observacion: input.observacion,
  });
  return RecordRepository.findByJefe(jefe.dniJefe);
}

function apiDeleteRecord(dniJefe, id) {
  const jefe = Access.authenticate(dniJefe);
  RecordRepository.remove(id, jefe.dniJefe);
  return RecordRepository.findByJefe(jefe.dniJefe);
}

const Access = {
  authenticate(rawDni) {
    const dniJefe = String(rawDni || '').replace(/\D/g, '');
    const cache = CacheService.getScriptCache();
    const failures = Number(cache.get('login_failures') || 0);
    if (failures >= CONFIG.ACCESS.MAX_FAILED_ATTEMPTS) {
      throw new Error('Demasiados intentos fallidos. Espera 15 minutos.');
    }

    const clients = dniJefe.length >= 6 ? ClientRepository.all().filter((c) => c.dniJefe === dniJefe) : [];
    if (!clients.length) {
      cache.put('login_failures', String(failures + 1), CONFIG.ACCESS.LOCK_SECONDS);
      Utilities.sleep(CONFIG.ACCESS.FAIL_DELAY_MS);
      throw new Error('DNI de jefe zonal no autorizado.');
    }
    return { dniJefe, nombreJefe: clients[0].nombreJefe, clients };
  },
};

const Db = {
  spreadsheet() {
    const id = PropertiesService.getScriptProperties().getProperty(CONFIG.PROPS.SPREADSHEET_ID);
    if (!id) throw new Error('Falta ejecutar setup() desde el editor.');
    return SpreadsheetApp.openById(id);
  },
  sheet(name) {
    const spreadsheet = this.spreadsheet();
    return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  },
  rows(name, width) {
    const sheet = this.sheet(name);
    const lastRow = sheet.getLastRow();
    return lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
  },
};

const Mapper = {
  toRow(keys, object) {
    return keys.map((key) => (object[key] == null ? '' : String(object[key])));
  },
  toObject(keys, row) {
    return keys.reduce((acc, key, i) => {
      acc[key] = row[i] == null ? '' : String(row[i]).trim();
      return acc;
    }, {});
  },
};

const ClientRepository = {
  all() {
    return Db.rows(CONFIG.CLIENTS.SHEET, CONFIG.CLIENTS.KEYS.length).map((row) => Mapper.toObject(CONFIG.CLIENTS.KEYS, row));
  },
};

const RecordRepository = {
  findByJefe(dniJefe) {
    return Db.rows(CONFIG.RECORDS.SHEET, CONFIG.RECORDS.KEYS.length)
      .filter((row) => row[0])
      .map((row) => Mapper.toObject(CONFIG.RECORDS.KEYS, row))
      .filter((r) => r.dniJefe === dniJefe)
      .reverse();
  },

  insert(record) {
    withLock_(() => Db.sheet(CONFIG.RECORDS.SHEET).appendRow(Mapper.toRow(CONFIG.RECORDS.KEYS, record)));
  },

  remove(id, dniJefe) {
    withLock_(() => {
      const sheet = Db.sheet(CONFIG.RECORDS.SHEET);
      const rows = Db.rows(CONFIG.RECORDS.SHEET, CONFIG.RECORDS.KEYS.length);
      const index = rows.findIndex((row) => row[0] === id);
      if (index < 0) return;

      const record = Mapper.toObject(CONFIG.RECORDS.KEYS, rows[index]);
      if (record.dniJefe !== dniJefe) throw new Error('No puedes eliminar registros de otra zonal.');
      if (record.audioFileId) AudioStorage.remove(record.audioFileId);
      sheet.deleteRow(index + 2);
    });
  },
};

const ClientSource = {
  read(fileId) {
    const file = DriveApp.getFileById(fileId);
    const isNative = file.getMimeType() === MimeType.GOOGLE_SHEETS;
    const sheetId = isNative ? fileId : this.convert(fileId);

    try {
      const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(CONFIG.CLIENTS.SOURCE_SHEET);
      if (!sheet) throw new Error(`No existe la hoja ${CONFIG.CLIENTS.SOURCE_SHEET} en el archivo de clientes.`);
      return this.normalize(sheet.getDataRange().getDisplayValues());
    } finally {
      if (!isNative) DriveApp.getFileById(sheetId).setTrashed(true);
    }
  },

  convert(fileId) {
    const copy = Drive.Files.copy({ name: `tmp_clientes_${Date.now()}`, mimeType: MimeType.GOOGLE_SHEETS }, fileId);
    return copy.id;
  },

  normalize(values) {
    const header = values[0].map((h) => String(h).trim().toUpperCase());
    const index = CONFIG.CLIENTS.KEYS.map((key) => {
      const i = header.indexOf(CONFIG.CLIENTS.SOURCE_HEADERS[key]);
      if (i < 0) throw new Error(`Falta la columna ${CONFIG.CLIENTS.SOURCE_HEADERS[key]} en la hoja de clientes.`);
      return i;
    });
    const jefeIndex = CONFIG.CLIENTS.KEYS.indexOf('dniJefe');

    const seen = new Set();
    return values
      .slice(1)
      .map((row) => index.map((i) => String(row[i]).trim()))
      .map((row) => {
        row[jefeIndex] = row[jefeIndex].replace(/\D/g, '');
        return row;
      })
      .filter((row) => {
        const key = `${row[0]}|${row[1]}`;
        if (!row[0] || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a[3].localeCompare(b[3]));
  },
};

const Validator = {
  record(payload) {
    const form = payload && payload.form;
    if (!form) throw new Error('Formulario vacío.');
    const fecha = String(form.fecha || '').trim();
    const dni = String(form.dni || '').trim();
    const codCliente = String(form.codCliente || '').trim();
    const observacion = String(form.observacion || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida.');
    if (!dni) throw new Error('Selecciona un cliente.');
    if (observacion.length > 2000) throw new Error('La observación supera 2000 caracteres.');
    return { fecha, dni, codCliente, observacion };
  },
};

const AudioStorage = {
  EXTENSIONS: {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/3gpp': '3gp',
    'audio/amr': 'amr',
  },

  save(audio, recordId) {
    const mimeType = String(audio.mimeType || '').split(';')[0].trim().toLowerCase();
    const extension = this.EXTENSIONS[mimeType];
    if (!extension) throw new Error(`Formato de audio no soportado: ${mimeType || 'desconocido'}.`);

    const bytes = Utilities.base64Decode(audio.base64);
    if (!bytes.length) throw new Error('El audio está vacío.');
    if (bytes.length > CONFIG.MAX_AUDIO_BYTES) throw new Error('El audio supera 25 MB.');

    const folderId = PropertiesService.getScriptProperties().getProperty(CONFIG.PROPS.AUDIO_FOLDER_ID);
    const file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mimeType, `${recordId}.${extension}`));
    return { id: file.getId(), url: file.getUrl() };
  },

  remove(fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (err) {
      console.warn(`Audio ${fileId} no encontrado: ${err.message}`);
    }
  },
};

function installSyncTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'syncClientes')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncClientes').timeBased().everyHours(1).create();
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
